// src/utils/userUtils.ts

import { PrismaClient, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();


export const updateUserCredits = async (
  userId: string,
  amount: number,
  type: TransactionType
) => {
  try {
    const credits = await prisma.credits.findUnique({
      where: { userId },
    });

    if (!credits) {
      throw new Error(`User ${userId} does not have a Credits record`);
    }

    const addOrSubtract = type === "USAGE" ? -1 : 1;

    const newBalance = credits.balance + amount * addOrSubtract;

    await prisma.credits.update({
      where: { userId },
      data: {
        balance: newBalance,
      },
    });

    await prisma.credit_transactions.create({
      data: {
        userId,
        amount,
        type,
        id: Math.random().toString(36).substring(7),
      },
    });

    console.log(`Updated credits for user ${userId}: ${amount}`);
    return newBalance;
  } catch (error) {
    console.error("Error updating credits:", error);
    return null;
  }
};
