import type {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";
import {assetNetworks, type Currency} from "./wallet.js";
import {z} from "zod";
import { redis } from "./redis.js"

const secretKey = process.env.SECRET_KEY;
if(!secretKey) throw new Error("SECRET_KEY is not set");

export const validateUserLogin = function(req:Request, res:Response, next: NextFunction){
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

export const rateLimiter = function (getClientID: (req:Request) => string,requestsLimit:number,ttl:number){
    return async function (req:Request, res:Response, next: NextFunction) {
        const key = `ratelimit:${getClientID(req)}`;
        const counter = await redis.incr(key);
        if(counter === 1) await redis.expire(key,ttl);
        if(counter > requestsLimit) return res.status(429).json({error: "Too many requests"});
        next();
    }
}

export const uniqueNetworks = [...new Set(Object.values(assetNetworks).flat().map(n => n.name))];

export const createWallet = z.object({
    currency: z.enum(Object.keys(assetNetworks) as Currency[]),
    network: z.enum(uniqueNetworks),
}).strict().refine((data) => {
    return assetNetworks[data.currency].some(net => net.name === data.network);
}, {message: "Enter correct chain for such currency"});

export const userRegistration = z.object({
    email: z.email(),
    password: z.string().min(8),
    confirmPassword: z.string()
}).strict().refine((data) => data.password === data.confirmPassword, {
    error: "Passwords don't match",
    path: ["confirmPassword"],
});

export const userLogin = z.object({
    email: z.email(),
    password: z.string().min(8),
});

export const paramsScheme = z.object({publicId: z.uuid()});

export const depositScheme = z.object({
    hash: z.string(),
    amount: z.string().regex(/^[1-9]\d*$/, "amount must be a positive integer")
})

export const withdrawalScheme = z.object({
    idempotencyKey: z.string(),
    amount: z.string().regex(/^[1-9]\d*$/, "amount must be a positive integer")
})
