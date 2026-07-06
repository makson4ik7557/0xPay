import {userLogin, userRegistration, validateUserLogin} from "../schemes.js";
import argon2 from "argon2";
import {Prisma} from "../generated/prisma/client.js";
import {EmailAlreadyTakenError} from "../errors.js";
import {prisma} from "../prisma.js"
import { Router } from "express";
import jwt from "jsonwebtoken";

const secretKey = process.env.SECRET_KEY;
if(!secretKey) throw new Error("SECRET_KEY is not set");
const router = Router();

router.post("/register", async (req, res) => {
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
});

router.post("/login", async (req, res) => {
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

router.get("/me", validateUserLogin, async (req, res) => {
    const validatedUser = await prisma.user.findUnique({where: {id: req.userId}})
    if(!validatedUser) return res.status(404).json({error: "User not found"});
    res.json({
        id: validatedUser.id,
        email: validatedUser.email,
        createdAt: validatedUser.createdAt,
    });
});
export default router;