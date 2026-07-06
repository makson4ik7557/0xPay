import express from "express";
import 'dotenv/config';
import type {Response,Request} from "express";
import { errorHandler } from "./errorHandler.js";
import authRouter from "./routes/auth.js";
import walletsRouter from "./routes/wallets.js";


const app = express();
app.use(express.json());
let port = 3000;
const secretKey = process.env.SECRET_KEY;
if(!secretKey) throw new Error("SECRET_KEY is not set");


(BigInt.prototype as any).toJSON = function (){
    return this.toString();
}

app.get('/health', (req:Request,res:Response) => {
    res.json({status: "ok"})
});

app.use('/wallets', walletsRouter);

app.use('/auth', authRouter);

app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/health`);
});