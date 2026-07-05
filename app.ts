import express from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import 'dotenv/config';
import type {Response,Request,NextFunction} from "express";
import type {Currency} from "./wallet.js";
import {assetNetworks} from "./wallet.js"
import {z} from "zod"
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma } from "./generated/prisma/client.js";

const app = express();
app.use(express.json());
let port = 3000;
const secretKey = process.env.SECRET_KEY;
if(!secretKey) throw new Error("SECRET_KEY is not set");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

(BigInt.prototype as any).toJSON = function (){
    return this.toString();
}

const validateUserLogin = function(req:Request, res:Response, next: NextFunction){
    const authHeader = req.headers.authorization;
    if(!authHeader) return res.status(401).json({error: "Unauthorized"});
    const arrayOfTokens = authHeader.split(" ");
    const token = arrayOfTokens[1];
    if(!token) return res.status(401).json({error: "Unauthorized"});
    try {
        const payload=  jwt.verify(token, secretKey);
        if(typeof payload !== "object") return res.status(401).json({error: "Unauthorized"});
        req.userId = payload.id;
        next();
    } catch (err) {
        console.error(err);
        return res.status(401).json({error: "Unauthorized"});
    }
}

const uniqueNetworks = [...new Set(Object.values(assetNetworks).flat().map(n => n.name))];

const createWallet = z.object({
    currency: z.enum(Object.keys(assetNetworks) as Currency[]),
    network: z.enum(uniqueNetworks),
}).strict().refine((data) => {
     return assetNetworks[data.currency].some(net => net.name === data.network);
     }, {message: "Enter correct chain for such currency"});

const userRegistration = z.object({
    email: z.email(),
    password: z.string().min(8),
    confirmPassword: z.string()
}).strict().refine((data) => data.password === data.confirmPassword, {
    error: "Passwords don't match",
    path: ["confirmPassword"],
});

const userLogin = z.object({
    email: z.email(),
    password: z.string().min(8),
});

const depositScheme = z.object({
    hash: z.string(),
    amount: z.number().int().positive()
})

app.get('/health', (req:Request,res:Response) => {
    res.json({status: "ok"})
});

app.post('/wallets', validateUserLogin, async (req:Request, res:Response) => {
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

class WalletNotFoundError extends Error {}
app.post('/wallets/:id/deposits' , validateUserLogin , async(req:Request,res:Response) => {
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

app.get('/wallets/:id' , validateUserLogin , async (req:Request,res:Response) => {
    const wallet = await prisma.wallet.findFirst({where: {id: Number(req.params.id) , userId: req.userId}});
    if(!wallet) return res.status(404).json({message: "Wallet with such id not found"});
    return res.json(wallet);
})

app.get('/wallets' , validateUserLogin , async (req:Request,res:Response) => {
    const allUserWallets = await prisma.wallet.findMany({where: {userId: req.userId}});
    return res.json(allUserWallets);
})

class EmailAlreadyTakenError extends Error {}
app.post('/auth/register', async (req:Request,res:Response,_next:NextFunction) => {
    const result = userRegistration.safeParse(req.body);
    if(!result.success) return res.status(400).json({error: result.error});
    const hashedPassword = await argon2.hash(result.data.password);
    try {
        const user = await prisma.user.create({
            data: { email: result.data.email, passwordHash: hashedPassword },
        });
        return res.status(201).json({
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
        });
    } catch (err) {
        if(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"){
            throw new EmailAlreadyTakenError();
        }
    }
})

app.post('/auth/login', async (req:Request,res:Response,_next:NextFunction) => {
    const result = userLogin.safeParse(req.body);
    if(!result.success) return res.status(400).json({error: result.error});
    const user = await prisma.user.findUnique({where: {email: result.data.email}});
    if(!user) return res.status(401).json({error: "Incorrect email or password"});
    const isMatch = await argon2.verify(user.passwordHash, result.data.password);
    if (isMatch) {
        const token = jwt.sign({ id: user.id}, secretKey , {
            expiresIn: '1 hour',
        });
        return res.json({ token: token });
    } else {
        return res.status(401).json({error: "Incorrect email or password"});
    }
});

app.get('/auth/me', validateUserLogin , async (req:Request,res:Response) => {
    const validatedUser = await prisma.user.findUnique({where: {id: req.userId}})
    if(!validatedUser) return res.status(404).json({error: "User not found"});
    res.json({
        id: validatedUser.id,
        email: validatedUser.email,
        createdAt: validatedUser.createdAt,
    });
});

app.use((err:Error, _req:Request, res:Response, _next:NextFunction) => {
    if(err instanceof WalletNotFoundError) return res.status(404).json({message: "Wallet with such id is not found"});
    else if(err instanceof EmailAlreadyTakenError) return res.status(409).json({error: "This email is already taken."});
    else return res.status(500).json({error: "Something went wrong" });
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/health`);
});