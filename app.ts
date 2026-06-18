import express , {type NextFunction}from "express";
import type {Response,Request} from "express";
import type {Currency, Networks, Wallet} from "./wallets.js";
import {assetNetworks} from "./wallets.js"
import {z} from "zod"

const app = express();
app.use(express.json());
let port = 3000;
let basicId = 0;
const wallets: Wallet[] = [];
const currencyDecimals = {
    BTC: 8,
    ETH: 18,
    USDT: 6,
} as const;

const uniqueNetworks = [...new Set(Object.values(assetNetworks).flat())];
const createWallet = z.object({
    ownerId: z.number(),
    currency: z.enum(Object.keys(assetNetworks)),
    network: z.enum(uniqueNetworks),
}).strict();

function validateCreate(req:Request,res:Response,next:NextFunction){
    const result = createWallet.safeParse(req.body);
    if(!result.success){
        return res.status(400).json({error: result.error});
    } else {
        next();
    }
}

app.get('/health', (req:Request,res:Response) => {
    res.json({status: "ok"})
});

app.post('/wallets', validateCreate, (req:Request, res:Response) => {
    const {ownerId , currency , network} = req.body;
    const newWallet: Wallet = {
        id: basicId++,
        ownerId: ownerId,
        address: "PLACEHOLDER_ADDRESS",
        balance: 0n,
        currency: currency,
        decimals: currencyDecimals[currency as Currency],
        network: network
    }
    wallets.push(newWallet);
    res.status(201).json({massage:"Wallet successfully created"})
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/health`);
});