require("dotenv").config();
const http = require("http");
const socketIO = require("socket.io");
const { soliditySha3 } = require("web3-utils");
const { generateRandomNumber } = require("./randomNumberGenerator.js");
const {
  appData,
  signAndProcessTransaction,
  web3,
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
const auctionsData = {}; // map auctionId to users set

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

appData.contract.events.NewBid({ fromBlock: 0 }, async (error, event) => {
  if (error) {
    console.log("error in announce round winner: " + error);
  } else {
    const bidData = {
      cardIndex: event.returnValues._cardIndex,
      bidder: event.returnValues._bidder,
    };
    // add bid to auctionsData map
    if (!auctionsData[bidData.cardIndex]) {
      auctionsData[bidData.cardIndex] = new Set();
    }
    auctionsData[bidData.cardIndex].add(bidData.bidder);
    console.log(auctionsData);
  }
});

appData.contract.events.AuctionCreated(
  { fromBlock: 0 },
  async (error, event) => {
    if (error) {
      console.log("error in announce round winner: " + error);
    } else {
      const blockNumber = event.blockNumber;
      const block = await web3.eth.getBlock(blockNumber);

      console.log(
        "Auction created for " +
          event.returnValues._cardIndex +
          " with min Amount of " +
          event.returnValues._minAmount +
          " moncoins" +
          " at " +
          new Date(block.timestamp * 1000).toLocaleString()
      );

      let timeToCall =
        new Date(block.timestamp * 1000 + 86400000).getTime() - Date.now();
      console.log("Time to call settleAuction: " + timeToCall);
      timeToCall = 500;
      if (timeToCall > 0) {
        setTimeout(async () => {
          try {
            if (!auctionsData[event.returnValues._cardIndex]) {
              auctionsData[event.returnValues._cardIndex] = new Set();
            }
            const encodedData = await appData.contract.methods
              .settleAuction(
                event.returnValues._cardIndex,
                Array.from(auctionsData[event.returnValues._cardIndex])
              )
              .encodeABI();

            await signAndProcessTransaction(encodedData);
            console.log("Successfully called settleAuction");
          } catch (error) {
            console.log("err in settle auction: " + error);
          }
        }, timeToCall);
      }
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
