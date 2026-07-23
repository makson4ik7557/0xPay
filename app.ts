import express from "express";
import 'dotenv/config';
import type {Response,Request} from "express";
import { errorHandler } from "./errorHandler.js";
import authRouter from "./routes/auth.js";
import walletsRouter from "./routes/wallets.js";
import {validateUserLogin,rateLimiter} from "./schemes.js";

const secretKey = process.env.SECRET_KEY;
if(!secretKey) throw new Error("SECRET_KEY is not set");
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? "5");
const RATE_LIMIT_TIME = Number(process.env.RATE_LIMIT_TIME ?? "60");

const app = express();
app.use(express.json());


(BigInt.prototype as any).toJSON = function (){
    return this.toString();
}

app.get('/health', (req:Request,res:Response) => {
    res.json({status: "ok"})
});

app.use('/wallets', validateUserLogin, rateLimiter(req => String(req.userId ?? "unknown"), 5 ,60), walletsRouter);

app.use('/auth', rateLimiter(req => req.ip ?? "unknown", 5 ,60) , authRouter);

app.use(errorHandler);

export default app;