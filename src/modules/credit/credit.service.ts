import mongoose from 'mongoose';
import User from '../auth/user.model';

export interface CreditDecision {
    creditScore: number;
    isEligible: boolean;
    maxLoanAmount: number;
    recommendation: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
    reasons: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Mock credit check service
 * In production, this would integrate with actual credit bureaus
 */
class CreditService {
    // Credit score thresholds
    private readonly EXCELLENT_SCORE = 750;
    private readonly GOOD_SCORE = 650;
    private readonly FAIR_SCORE = 550;
    private readonly POOR_SCORE = 450;

    /**
     * Generate a mock credit score based on user data
     * In production, this would call external credit bureau APIs
     */
    private generateMockCreditScore(hasBvn: boolean): number {
        // Base score
        let baseScore = 500;

        // BVN verification adds points
        if (hasBvn) {
            baseScore += 100;
        }

        // Add some randomness (±150 points)
        const randomFactor = Math.floor(Math.random() * 300) - 150;
        const finalScore = Math.max(300, Math.min(850, baseScore + randomFactor));

        return finalScore;
    }

    /**
     * Calculate maximum loan amount based on credit score
     */
    private getMaxLoanAmount(creditScore: number): number {
        if (creditScore >= this.EXCELLENT_SCORE) {
            return 5000000; // 5 million
        } else if (creditScore >= this.GOOD_SCORE) {
            return 2000000; // 2 million
        } else if (creditScore >= this.FAIR_SCORE) {
            return 500000; // 500k
        } else if (creditScore >= this.POOR_SCORE) {
            return 100000; // 100k
        }
        return 0; // Not eligible
    }

    /**
     * Determine risk level based on credit score
     */
    private getRiskLevel(creditScore: number): 'LOW' | 'MEDIUM' | 'HIGH' {
        if (creditScore >= this.GOOD_SCORE) {
            return 'LOW';
        } else if (creditScore >= this.FAIR_SCORE) {
            return 'MEDIUM';
        }
        return 'HIGH';
    }

    /**
     * Perform credit check for a user
     */
    async performCreditCheck(
        userId: string,
        requestedAmount: number
    ): Promise<CreditDecision> {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // Generate or use existing credit score
        let creditScore = user.creditScore;
        if (!creditScore) {
            creditScore = this.generateMockCreditScore(!!user.bvn);

            // Save credit score to user
            await User.findByIdAndUpdate(userId, { creditScore });
        }

        const maxLoanAmount = this.getMaxLoanAmount(creditScore);
        const riskLevel = this.getRiskLevel(creditScore);
        const isEligible = creditScore >= this.POOR_SCORE && requestedAmount <= maxLoanAmount;

        // Determine recommendation
        let recommendation: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
        const reasons: string[] = [];

        if (creditScore >= this.GOOD_SCORE && requestedAmount <= maxLoanAmount) {
            recommendation = 'APPROVE';
            reasons.push('Good credit score');
            reasons.push('Requested amount within limit');
        } else if (creditScore >= this.FAIR_SCORE && requestedAmount <= maxLoanAmount) {
            recommendation = 'MANUAL_REVIEW';
            reasons.push('Moderate credit score - requires manual review');
        } else if (creditScore < this.POOR_SCORE) {
            recommendation = 'REJECT';
            reasons.push('Credit score below minimum threshold');
        } else if (requestedAmount > maxLoanAmount) {
            recommendation = 'REJECT';
            reasons.push(`Requested amount exceeds maximum eligible amount of ${maxLoanAmount}`);
        } else {
            recommendation = 'MANUAL_REVIEW';
            reasons.push('Edge case - requires manual assessment');
        }

        // Additional checks
        if (!user.bvn) {
            reasons.push('BVN not verified - consider requesting verification');
        }

        return {
            creditScore,
            isEligible,
            maxLoanAmount,
            recommendation,
            reasons,
            riskLevel,
        };
    }

    /**
     * Get credit report for a user
     */
    async getCreditReport(userId: string): Promise<{
        creditScore: number;
        maxLoanAmount: number;
        riskLevel: string;
        hasBvn: boolean;
    }> {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        const creditScore = user.creditScore || this.generateMockCreditScore(!!user.bvn);

        return {
            creditScore,
            maxLoanAmount: this.getMaxLoanAmount(creditScore),
            riskLevel: this.getRiskLevel(creditScore),
            hasBvn: !!user.bvn,
        };
    }
}

export default new CreditService();
