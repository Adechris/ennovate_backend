import { generateReference } from '../utils/helpers';

export interface TransferRequest {
    amount: number;
    accountNumber: string;
    bankCode: string;
    narration?: string;
    reference?: string;
}

export interface TransferResult {
    success: boolean;
    reference: string;
    providerReference?: string;
    message: string;
    amount: number;
    fee: number;
    timestamp: Date;
}

export interface PaymentVerification {
    verified: boolean;
    status: 'success' | 'pending' | 'failed';
    amount: number;
    reference: string;
    paidAt?: Date;
}

/**
 * Mock Payment Provider
 * Simulates integration with a payment gateway like Paystack, Flutterwave, etc.
 */
class MockPaymentProvider {
    private readonly SUCCESS_RATE = 0.95; // 95% success rate

    /**
     * Simulate a bank transfer (disbursement)
     */
    async transfer(request: TransferRequest): Promise<TransferResult> {
        const { amount, accountNumber, bankCode, narration, reference } = request;

        // Simulate API delay
        await this.simulateDelay(500, 2000);

        const txnReference = reference || generateReference('TRF');
        const isSuccess = Math.random() < this.SUCCESS_RATE;

        if (!isSuccess) {
            return {
                success: false,
                reference: txnReference,
                message: 'Transfer failed - Insufficient funds in settlement account',
                amount,
                fee: 0,
                timestamp: new Date(),
            };
        }

        // Calculate transfer fee (mock)
        const fee = amount < 5000 ? 10 : amount < 50000 ? 25 : 50;

        return {
            success: true,
            reference: txnReference,
            providerReference: `PROV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: 'Transfer successful',
            amount,
            fee,
            timestamp: new Date(),
        };
    }

    /**
     * Verify a payment/transaction
     */
    async verifyPayment(reference: string): Promise<PaymentVerification> {
        // Simulate API delay
        await this.simulateDelay(200, 500);

        // Mock: 90% of verifications are successful
        const isSuccess = Math.random() < 0.9;

        return {
            verified: true,
            status: isSuccess ? 'success' : 'pending',
            amount: 0, // Would be populated from actual provider
            reference,
            paidAt: isSuccess ? new Date() : undefined,
        };
    }

    /**
     * Initialize a payment collection (for repayments via card/bank)
     */
    async initializePayment(
        amount: number,
        email: string,
        reference: string
    ): Promise<{
        authorizationUrl: string;
        accessCode: string;
        reference: string;
    }> {
        // Simulate API delay
        await this.simulateDelay(300, 800);

        return {
            authorizationUrl: `https://mock-payment.com/pay/${reference}`,
            accessCode: `ACCESS-${Math.random().toString(36).substr(2, 9)}`,
            reference,
        };
    }

    /**
     * Process a direct bank debit (for automated repayments)
     */
    async debitAccount(
        amount: number,
        accountNumber: string,
        bankCode: string,
        reference: string
    ): Promise<TransferResult> {
        // Simulate API delay
        await this.simulateDelay(800, 2500);

        const isSuccess = Math.random() < this.SUCCESS_RATE;

        return {
            success: isSuccess,
            reference,
            providerReference: isSuccess
                ? `DEBIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                : undefined,
            message: isSuccess ? 'Debit successful' : 'Insufficient funds',
            amount,
            fee: 0,
            timestamp: new Date(),
        };
    }

    /**
     * Simulate random API delay
     */
    private simulateDelay(minMs: number, maxMs: number): Promise<void> {
        const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        return new Promise((resolve) => setTimeout(resolve, delay));
    }
}

// Export singleton instance
export const paymentProvider = new MockPaymentProvider();
