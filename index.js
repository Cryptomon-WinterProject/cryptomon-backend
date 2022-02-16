require("dotenv").config();
const http = require("http");
const socketIO = require("socket.io");
const { soliditySha3 } = require("web3-utils");
const {
  appData,
  signAndProcessTransaction,
} = require("./transactionHandler.js");

const port = process.env.PORT || 8000;
const server = http.createServer();
server
  .listen(port)
  .on("error", (err) => {
    console.log(err);
  })
  .on("listening", () => {
    console.log("Server is listening on port " + port);
  });

const io = socketIO(server);

const users = {};
const challanges = {};

appData.contract.events.ChallengeReady(
  //   { fromBlock: 0 },
  async (error, event) => {
    if (error) {
      console.log("error:", error);
    } else {
      console.log(
        event.returnValues._player + " -> " + event.returnValues._ready
      );
    }
  }
);

appData.contract.events.NewChallenge(async (error, event) => {
  if (error) {
    console.log("error:", error);
  } else {
    const challanger = event.returnValues._challenger;
    const opponent = event.returnValues._opponent;

    // Calculate challange hash with challanger and opponent soliditySha3
    const challangeHash = soliditySha3(
      { type: "address", value: challanger },
      { type: "address", value: opponent }
    );
    console.log("New challange: " + challangeHash);
    challanges[challangeHash] = true;
  }
});

appData.contract.events.AcceptChallenge(async (error, event) => {
  if (error) {
    console.log("error:", error);
  } else {
    const receivedChallangeHash = event.returnValues._challengeHash;
    console.log("Accepted challange: " + receivedChallangeHash);
  }
});

io.on("connection", function (socket) {
  socket.on("login", async function (data) {
    users[socket.id] = data.address;

    const encodedData = appData.contract.methods
      .updateUserConnectivityStatus(data.address, true)
      .encodeABI();

    await signAndProcessTransaction(encodedData);
  });

  socket.on("disconnect", async function () {
    if (users[socket.id]) {
      const encodedData = appData.contract.methods
        .updateUserConnectivityStatus(users[socket.id], false)
        .encodeABI();
      await signAndProcessTransaction(encodedData);
    }
    delete users[socket.id];
  });
});
