import {type Request, type Response, Router} from "express";
import {createWallet, depositScheme, withdrawalScheme, validateUserLogin} from "../schemes.js";
import {prisma} from "../prisma.js";
import {WalletNotFoundError,InsufficientFundsError} from "../errors.js";
import { Prisma } from "../generated/prisma/client.js";


const router = Router();

router.post("/",validateUserLogin, async (req:Request, res:Response) => {
    const result = createWallet.safeParse(req.body);
    if(!result.success) return res.status(400).json({error: result.error});
    const newWallet = await prisma.wallet.create({
        data : {userId: req.userId , address: "PLACEHOLDER_ADDRESS" , currency: result.data.currency , network: result.data.network}
    })
    return res.status(201).json({
        id: newWallet.id,
        userId: newWallet.userId,
        address: newWallet.address,
        balance: newWallet.balance,
        currency: newWallet.currency,
        network: newWallet.network,
        createdAt: newWallet.createdAt,
    })
})

router.post("/:id/deposits" , validateUserLogin , async(req:Request,res:Response) => {
    const result = depositScheme.safeParse(req.body);
    if(!result.success) return res.status(400).json({error: result.error});
    try {
        const dep = await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findFirst({where: {id: Number(req.params.id), userId: req.userId}});
            if (!wallet) throw new WalletNotFoundError()
            const newDepTx = await tx.transaction.create({data: {transactionHash: result.data.hash, type: "deposit", amount: BigInt(result.data.amount), walletId: wallet.id} })
            const walletBalance = await tx.wallet.update({
                where: {id: wallet.id},
                data: {balance: {increment: BigInt(result.data.amount)}}
            });
            return {newDepTx , walletBalance};
        })
        return res.status(201).json({
            id: dep.newDepTx.id,
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
                id: existingTransaction.id,
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

router.post("/:id/withdrawals" , validateUserLogin , async(req:Request,res:Response) => {
    const result = withdrawalScheme.safeParse(req.body);
    if(!result.success) return res.status(400).json({error: result.error});
    try {
        const withdrawal = await prisma.$transaction(async(tx) => {
            const wallet = await tx.wallet.findFirst({where: {id: Number(req.params.id), userId: req.userId}});
            if(!wallet) throw new WalletNotFoundError();
            const withdrawalResult = await tx.wallet.updateMany({
                where: {id: Number(req.params.id), userId: req.userId, balance: {gte: BigInt(result.data.amount)}},
                data: {balance: {decrement: BigInt(result.data.amount)}}
            })
            if(withdrawalResult.count === 0) throw new InsufficientFundsError();
            const newWithdrawalTx = await tx.transaction.create({data: {idempotencyKey: result.data.idempotencyKey, type: "withdrawal", amount: BigInt(result.data.amount), walletId: wallet.id} });
            const walletAfterWithdrawal = await tx.wallet.findUnique({where: {id: Number(req.params.id)}})
            return {newWithdrawalTx, walletAfterWithdrawal};
        })
        return res.status(201).json({
            id: withdrawal.newWithdrawalTx.id,
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
                id: existingTransaction.id,
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

router.get("/:id", validateUserLogin , async (req:Request,res:Response) => {
    const wallet = await prisma.wallet.findFirst({where: {id: Number(req.params.id), userId: req.userId}});
    if (!wallet) return res.status(404).json({message: "Wallet with such id not found"});
    return res.json(wallet);
});

router.get("/", validateUserLogin , async (req:Request,res:Response) => {
    const allUserWallets = await prisma.wallet.findMany({where: {userId: req.userId}});
    return res.json(allUserWallets);
});
export default router;