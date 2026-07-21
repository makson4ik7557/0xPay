import {type Request, type Response, Router} from "express";
import {
    createWallet,
    paramsScheme,
    depositScheme,
    withdrawalScheme,
    validateUserLogin,
    rateLimiter
} from "../schemes.js";
import {prisma} from "../prisma.js";
import {WalletNotFoundError,InsufficientFundsError} from "../errors.js";
import { Prisma } from "../generated/prisma/client.js";


const router = Router();

router.post("/",validateUserLogin,rateLimiter , async (req:Request, res:Response) => {
    const result = createWallet.safeParse(req.body);
    if(!result.success) return res.status(400).json({error: result.error});
    const newWallet = await prisma.wallet.create({
        data : {userId: req.userId , address: "PLACEHOLDER_ADDRESS" , currency: result.data.currency , network: result.data.network}
    })
    return res.status(201).json({
        publicId: newWallet.publicId,
        address: newWallet.address,
        balance: newWallet.balance,
        currency: newWallet.currency,
        network: newWallet.network,
        createdAt: newWallet.createdAt,
    })
})

router.post("/:publicId/deposits" , validateUserLogin ,rateLimiter , async(req:Request,res:Response) => {
    const result = depositScheme.safeParse(req.body);
    const paramsResult = paramsScheme.safeParse(req.params);
    if(!result.success) return res.status(400).json({error: result.error});
    else if(!paramsResult.success) return res.status(400).json({error: paramsResult.error});
    try {
        const dep = await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findFirst({where: {publicId: paramsResult.data.publicId, userId: req.userId}});
            if (!wallet) throw new WalletNotFoundError();
            const newDepTx = await tx.transaction.create({data: {transactionHash: result.data.hash, type: "deposit", amount: BigInt(result.data.amount), walletId: wallet.id}})
            const walletBalance = await tx.wallet.update({
                where: {id: wallet.id},
                data: {balance: {increment: BigInt(result.data.amount)}}
            });
            return {newDepTx , walletBalance};
        })
        return res.status(201).json({
            publicId: dep.newDepTx.publicId,
            amount: dep.newDepTx.amount,
            type: dep.newDepTx.type,
            status: dep.newDepTx.status,
            createdAt: dep.newDepTx.createdAt,
            balance: dep.walletBalance.balance
        })
    } catch(err){
        if(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existingTransaction = await prisma.transaction.findUnique({where: {transactionHash: result.data.hash}});
            if(!existingTransaction) throw new Error;
            const userBalance = await prisma.wallet.findUnique({where: {id: existingTransaction.walletId}});
            if(!userBalance) throw new Error;
            return res.status(200).json({
                publicId: existingTransaction.publicId,
                amount: existingTransaction.amount,
                type: existingTransaction.type,
                status: existingTransaction.status,
                createdAt: existingTransaction.createdAt,
                balance: userBalance.balance
            });
        }
        else throw err;
    }
})

router.post("/:publicId/withdrawals" , validateUserLogin , rateLimiter , async(req:Request,res:Response) => {
    const result = withdrawalScheme.safeParse(req.body);
    const paramsResult = paramsScheme.safeParse(req.params);
    if(!result.success) return res.status(400).json({error: result.error});
    else if(!paramsResult.success) return res.status(400).json({error: paramsResult.error});
    try {
        const withdrawal = await prisma.$transaction(async(tx) => {
            const wallet = await tx.wallet.findFirst({where: {publicId: paramsResult.data.publicId, userId: req.userId}});
            if(!wallet) throw new WalletNotFoundError();
            const withdrawalResult = await tx.wallet.updateMany({
                where: {publicId: paramsResult.data.publicId, userId: req.userId, balance: {gte: BigInt(result.data.amount)}},
                data: {balance: {decrement: BigInt(result.data.amount)}}
            });
            if(withdrawalResult.count === 0) throw new InsufficientFundsError();
            const newWithdrawalTx = await tx.transaction.create({data: {idempotencyKey: result.data.idempotencyKey, type: "withdrawal", amount: BigInt(result.data.amount), walletId: wallet.id} });
            const walletAfterWithdrawal = await tx.wallet.findUnique({where: {publicId: paramsResult.data.publicId}})
            return {newWithdrawalTx, walletAfterWithdrawal};
        })
        return res.status(201).json({
            publicId: withdrawal.newWithdrawalTx.publicId,
            idempotencyKey: withdrawal.newWithdrawalTx.idempotencyKey,
            amount: withdrawal.newWithdrawalTx.amount,
            type: withdrawal.newWithdrawalTx.type,
            status: withdrawal.newWithdrawalTx.status,
            createdAt: withdrawal.newWithdrawalTx.createdAt,
            balance: withdrawal.walletAfterWithdrawal!.balance
        })
    } catch (err) {
        if(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existingTransaction = await prisma.transaction.findUnique({where: {idempotencyKey: result.data.idempotencyKey}});
            if(!existingTransaction) throw new Error;
            const userBalance = await prisma.wallet.findUnique({where: {id: existingTransaction.walletId}});
            if(!userBalance) throw new Error;
            return res.status(200).json({
                publicId: existingTransaction.publicId,
                idempotencyKey: existingTransaction.idempotencyKey,
                amount: existingTransaction.amount,
                type: existingTransaction.type,
                status: existingTransaction.status,
                createdAt: existingTransaction.createdAt,
                balance: userBalance.balance
            });
        }
        else throw err;
    }
})

router.get("/:publicId", validateUserLogin ,rateLimiter , async (req:Request,res:Response) => {
    const paramsResult = paramsScheme.safeParse(req.params);
    if(!paramsResult.success) return res.status(400).json({error: paramsResult.error});
    const wallet = await prisma.wallet.findFirst({
        where: {publicId: paramsResult.data.publicId, userId: req.userId },
        include: {transactions: { orderBy: { createdAt: "desc" }, take: 20 }}
    });
    if (!wallet) return res.status(404).json({message: "Wallet with such id not found"});
    return res.json({
        publicId: wallet.publicId,
        address: wallet.address,
        balance: wallet.balance,
        currency: wallet.currency,
        network: wallet.network,
        createdAt: wallet.createdAt,
        transactions: wallet.transactions.map(tx => ({
            publicId: tx.publicId,
            amount: tx.amount,
            type: tx.type,
            status: tx.status,
            createdAt: tx.createdAt
        }))
    });
});

router.get("/", validateUserLogin ,rateLimiter , async (req:Request,res:Response) => {
    const allUserWallets = await prisma.wallet.findMany({where: {userId: req.userId}});
    return res.json(allUserWallets.map(wallet => ({
        publicId: wallet.publicId,
        address: wallet.address,
        balance: wallet.balance,
        currency: wallet.currency,
        network: wallet.network,
        createdAt: wallet.createdAt})
    ));
});
export default router;