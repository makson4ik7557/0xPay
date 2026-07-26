import type {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";

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