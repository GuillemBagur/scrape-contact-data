const express = require("express");
const path = require("path");
const cors = require("cors");
const { getPossibleCustomers } = require("./js/scrape");

const app = express();
app.use(express.static(path.join(__dirname, "../src")));

app.use(
  cors({
    origin: "*",
  })
);

app.listen(3000, () => console.log("listening on port 3000"));

app.get("/", async (req, res) => {
  const query = req.query.q;
  const data = await getPossibleCustomers(query);
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:4000");
  res.json(data);
});
