import User, { IUser } from './user.model';
import { generateToken } from '../../shared/middleware/auth.middleware';
import {
    AuthenticationError,
    ConflictError,
    NotFoundError,
} from '../../shared/utils/app-error';

interface RegisterInput {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    bvn?: string;
}

interface LoginInput {
    email: string;
    password: string;
}

interface AuthResponse {
    user: Partial<IUser>;
    token: string;
}

interface AdminRegisterInput extends RegisterInput {
    adminSecret: string;
}

class AuthService {
    /**
     * Register a new user
     */
    async register(input: RegisterInput): Promise<AuthResponse> {
        const { email, password, firstName, lastName, phone, bvn } = input;

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new ConflictError('User with this email already exists');
        }

        // Create new user
        const user = await User.create({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            phone,
            bvn,
            role: 'user',
        });

        // Generate token
        const token = generateToken(user);

        return {
            user: this.sanitizeUser(user),
            token,
        };
    }

    /**
     * Login user
     */
    async login(input: LoginInput): Promise<AuthResponse> {
        const { email, password } = input;

        // Find user with password
        const user = await User.findOne({ email: email.toLowerCase() }).select(
            '+password'
        );

        if (!user) {
            throw new AuthenticationError('Invalid email or password');
        }

        if (!user.isActive) {
            throw new AuthenticationError('Account is deactivated. Please contact support.');
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new AuthenticationError('Invalid email or password');
        }

        // Generate token
        const token = generateToken(user);

        return {
            user: this.sanitizeUser(user),
            token,
        };
    }

    /**
     * Get user profile
     */
    async getProfile(userId: string): Promise<Partial<IUser>> {
        const user = await User.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        return this.sanitizeUser(user);
    }

    /**
     * Update user profile
     */
    async updateProfile(
        userId: string,
        updates: Partial<Pick<IUser, 'firstName' | 'lastName' | 'phone' | 'bvn'>>
    ): Promise<Partial<IUser>> {
        const allowedUpdates = ['firstName', 'lastName', 'phone', 'bvn'];
        const updateKeys = Object.keys(updates);

        // Filter out any non-allowed fields
        const filteredUpdates: Record<string, any> = {};
        updateKeys.forEach((key) => {
            if (allowedUpdates.includes(key)) {
                filteredUpdates[key] = (updates as any)[key];
            }
        });

        const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
            new: true,
            runValidators: true,
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        return this.sanitizeUser(user);
    }

    /**
     * Remove sensitive fields from user object
     */
    private sanitizeUser(user: IUser): Partial<IUser> {
        const userObj = user.toObject();
        delete userObj.password;
        return userObj;
    }

    /**
     * Register a new admin
     */
    async adminRegister(input: AdminRegisterInput): Promise<AuthResponse> {
        const { email, password, firstName, lastName, phone, bvn, adminSecret } = input;

        // Verify admin secret
        const expectedSecret = process.env.ADMIN_SECRET_KEY || 'super-secret-admin-key';
        if (adminSecret !== expectedSecret) {
            throw new AuthenticationError('Invalid admin secret key');
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new ConflictError('User with this email already exists');
        }

        // Create new admin
        const user = await User.create({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            phone,
            bvn,
            role: 'admin',
        });

        // Generate token
        const token = generateToken(user);

        return {
            user: this.sanitizeUser(user),
            token,
        };
    }

    /**
     * Login admin
     */
    async adminLogin(input: LoginInput): Promise<AuthResponse> {
        const { email, password } = input;

        // Find user with password
        const user = await User.findOne({ email: email.toLowerCase() }).select(
            '+password'
        );

        if (!user) {
            throw new AuthenticationError('Invalid email or password');
        }

        if (user.role !== 'admin') {
            throw new AuthenticationError('Access denied. Admin only.');
        }

        if (!user.isActive) {
            throw new AuthenticationError('Account is deactivated. Please contact support.');
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new AuthenticationError('Invalid email or password');
        }

        // Generate token
        const token = generateToken(user);

        return {
            user: this.sanitizeUser(user),
            token,
        };
    }
}

export default new AuthService();
