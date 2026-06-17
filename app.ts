import express from "express";
import type {Response,Request} from "express";

const app = express();
let port = 3000;
app.use(express.json());

app.get('/health', (req:Request,res:Response) => {
    res.json({status: "ok"})
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});