import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import encryptionService from '../../shared/services/encryption.service';

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    bvn?: string;
    role: 'user' | 'admin';
    creditScore?: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    getDecryptedBvn(): string;
    fullName: string;
}

const userSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
            maxlength: [50, 'First name cannot exceed 50 characters'],
        },
        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
            maxlength: [50, 'Last name cannot exceed 50 characters'],
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
        },
        bvn: {
            type: String,
            trim: true,
            minlength: [11, 'BVN must be 11 digits'],
            maxlength: [11, 'BVN must be 11 digits'],
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        creditScore: {
            type: Number,
            min: 0,
            max: 850,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual for full name
userSchema.virtual('fullName').get(function (this: IUser) {
    return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

// Encrypt BVN before saving
userSchema.pre('save', function (next) {
    if (!this.isModified('bvn') || !this.bvn) return next();
    try {
        this.bvn = encryptionService.encrypt(this.bvn);
        next();
    } catch (error: any) {
        next(error);
    }
});

// Method to get decrypted BVN
userSchema.methods.getDecryptedBvn = function (): string {
    return this.bvn ? encryptionService.decrypt(this.bvn) : '';
};

// Index for faster queries
userSchema.index({ role: 1 });

const User = mongoose.model<IUser>('User', userSchema);

export default User;
