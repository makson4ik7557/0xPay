import { WalletNotFoundError, EmailAlreadyTakenError } from "./errors.js";
import type {NextFunction, Request, Response} from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof WalletNotFoundError) return res.status(404).json({message: "Wallet not found"});
    else if (err instanceof EmailAlreadyTakenError) return res.status(409).json({error: "This email is already taken"});
    else return res.status(500).json({error: "Something went wrong"});
}