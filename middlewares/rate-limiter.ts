import type {NextFunction,Request, Response} from "express";
import {redis} from "../redis.js";

const atomicIncrWithExpiryScript = `
    local counter = redis.call('INCR',KEYS[1])
    if counter == 1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end
    return counter
`;

export const rateLimiter = function (getClientID: (req:Request) => string,requestsLimit:number,ttl:number){
    return async function (req:Request, res:Response, next: NextFunction) {
        const key = `ratelimit:${getClientID(req)}`;
        const counter = Number(await redis.eval(atomicIncrWithExpiryScript,1, key, ttl));
        if(counter > requestsLimit) return res.status(429).json({error: "Too many requests"});
        next();
    }
}