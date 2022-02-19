require("dotenv").config();
const http = require("http");
const socketIO = require("socket.io");
const { soliditySha3 } = require("web3-utils");
const { generateRandomNumber } = require("./randomNumberGenerator.js");
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

const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});

const users = {};
// Set of users
const onlineUsers = new Set();

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

appData.contract.events.NewChallenge({ fromBlock: 0 }, async (error, event) => {
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
    console.log(
      "New challange: " +
        challangeHash +
        " from " +
        challanger +
        " to " +
        opponent
    );
  }
});

appData.contract.events.AcceptChallenge(
  // { fromBlock: 0 },
  async (error, event) => {
    if (error) {
      console.log("error:", error);
    } else {
      const receivedChallangeHash = event.returnValues._challengeHash;
      console.log("Accepted challange: " + receivedChallangeHash);
      try {
        const rndomNums = generateRandomNumber(3, 1000);
        console.log(
          "Setting challenge " + receivedChallangeHash + " " + rndomNums
        );
        const encodedData = await appData.contract.methods
          .settleChallenge(receivedChallangeHash, rndomNums)
          .encodeABI();

        await signAndProcessTransaction(encodedData);
      } catch (error) {
        console.log("err in settle challange: " + error);
      }
    }
  }
);

appData.contract.events.AnnounceRoundWinner(
  { fromBlock: 0 },
  async (error, event) => {
    if (error) {
      console.log("error in announce round winner: " + error);
    } else {
      console.log(
        "Round winner of " +
          event.returnValues._challengeHash +
          " is " +
          event.returnValues._winner +
          " with " +
          event.returnValues._xpGained +
          " xp"
      );
    }
  }
);
appData.contract.events.AnnounceWinner(
  { fromBlock: 0 },
  async (error, event) => {
    if (error) {
      console.log("error in announce winner: " + error);
    } else {
      console.log(
        "Winner of " +
          event.returnValues._challengeHash +
          " is " +
          event.returnValues._winner +
          " with " +
          event.returnValues.increasedMoncoins +
          " moncoins"
      );
    }
  }
);

io.on("connection", function (socket) {
  socket.on("login", async function (data) {
    if (users[socket.id]) {
      onlineUsers.delete(users[socket.id]);
      delete users[socket.id];
    }
    users[socket.id] = data.address;
    onlineUsers.add(data.address);
    io.emit("statusUpdate", Array.from(onlineUsers));
  });

  socket.on("disconnect", async function () {
    onlineUsers.delete(users[socket.id]);
    io.emit("statusUpdate", Array.from(onlineUsers));
    delete users[socket.id];
  });
});
