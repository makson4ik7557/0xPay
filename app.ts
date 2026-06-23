import express from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import 'dotenv/config';
import type {Response,Request,NextFunction} from "express";
import type {Currency, Wallet} from "./wallet.js";
import type {User} from "./user.js";
import {assetNetworks} from "./wallet.js"
import {z} from "zod"


const app = express();
app.use(express.json());
let port = 3000;
let basicIdOfWallets = 0;
let basicIdOfUsers = 1;
const loginError = "Incorrect personal data: check password or email";
const secretKey = process.env.SECRET_KEY;
if(!secretKey) throw new Error("SECRET_KEY is not set");

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
        next();
    } catch (err) {
        console.error(err);
        return res.status(401).json({error: "Unauthorized"});
    }
}

const wallets: Wallet[] = [];
const users: User[] = [];

const currencyDecimals = {
    BTC: 8,
    ETH: 18,
    USDT: 6,
} as const;

const uniqueNetworks = [...new Set(Object.values(assetNetworks).flat())];
const createWallet = z.object({
    ownerId: z.number(),
    currency: z.enum(Object.keys(assetNetworks) as Currency[]),
    network: z.enum(uniqueNetworks),
}).strict().refine((data) => {
     return (assetNetworks[data.currency] as readonly string[]).includes(data.network);
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

app.get('/health', (req:Request,res:Response) => {
    res.json({status: "ok"})
});

app.post('/wallets', (req:Request, res:Response) => {
    const result = createWallet.safeParse(req.body);
    if(!result.success) return res.status(400).json({error: result.error});
    const newWallet: Wallet = {
        id: basicIdOfWallets++,
        ownerId: result.data.ownerId,
        address: "PLACEHOLDER_ADDRESS",
        balance: 0n,
        currency: result.data.currency,
        decimals: currencyDecimals[result.data.currency],
        network: result.data.network
    }
    wallets.push(newWallet);
    res.status(201).json({message:"Wallet successfully created"})
})

app.get('/wallets/:id' , (req:Request,res:Response) => {
    const wallet = wallets.find(w => w.id === Number(req.params.id));
    if(!wallet) return res.status(404).json({message: "Wallet with such id not found"})
    res.json(wallet);
})

app.get('/wallets' , (req:Request,res:Response) => {
    res.json(wallets);
})

app.post('/auth/register', async (req:Request,res:Response) => {
    const result = userRegistration.safeParse(req.body);
    if(!result.success) return res.status(400).json({error: result.error});
    const emailValidation = users.some(u => u.email === result.data.email);
    if(emailValidation) return res.status(409).json({error: "This email is already taken."});
    const hashedPassword = await argon2.hash(result.data.password);
    const newUser: User = {
        id: basicIdOfUsers++,
        email: result.data.email,
        passwordHash: hashedPassword,
        createdAt: Date.now(),
    }
    users.push(newUser);
    res.status(201).json({message:"User successfully created"})
})

app.post('/auth/login', async (req:Request,res:Response) => {
    const result = userLogin.safeParse(req.body);
    if(!result.success) return res.status(400).json({error: result.error});
    const emailValidatedUser = users.find(u => u.email === result.data.email);
    if(!emailValidatedUser) return res.status(401).json({error: loginError});
    try {
        const isMatch = await argon2.verify(emailValidatedUser.passwordHash, result.data.password);
        if (isMatch) {
            const token = jwt.sign({ id: emailValidatedUser.id}, secretKey , {
                expiresIn: '1 hour',
            });
        return res.json({ token: token });
        } else {
            return res.status(401).json({error: loginError});
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({error: 'Internal server error'});
    }
});

app.get('/auth/me', validateUserLogin ,(req:Request,res:Response) => {
    res.json({status: "ok:true"})
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/health`);
});