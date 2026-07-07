import app from "./app.js"

let port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/health`);
});