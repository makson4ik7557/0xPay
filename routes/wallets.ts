import {type Request, type Response, Router} from "express";
import {createWallet, depositScheme, validateUserLogin} from "../schemes.js";
import {prisma} from "../prisma.js";
import {WalletNotFoundError} from "../errors.js";
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
            const newDep = await tx.transaction.create({data: {transactionHash: result.data.hash, type: "deposit", amount: BigInt(result.data.amount), walletId: wallet.id} })
            const walletBalance = await tx.wallet.update({
                where: {id: wallet.id},
                data: {balance: {increment: BigInt(result.data.amount)}}
            });
            return {newDep , walletBalance};
        })
        return res.status(201).json({
            id: dep.newDep.id,
            amount: dep.newDep.amount,
            type: dep.newDep.type,
            status: dep.newDep.status,
            createdAt: dep.newDep.createdAt,
            balance: dep.walletBalance.balance
        })
    } catch(err){
        if(err instanceof WalletNotFoundError) throw new WalletNotFoundError();
        else if(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
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
        else throw new Error;
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