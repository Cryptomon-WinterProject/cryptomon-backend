const Web3 = require("web3");
const { address, abi } = require("./config.js");

appData = {};

const { WEB3_PROVIDER, ACCOUNT_PRIVATE_KEY } = process.env;
const web3 = new Web3(WEB3_PROVIDER);

appData.account = "0xC48E03A9e023b0b12173dAeE8E61e058062BC327";
appData.contract = new web3.eth.Contract(abi, address);

const signTransaction = async (encodedData) => {
  const signedTransaction = await web3.eth.accounts.signTransaction(
    {
      to: address,
      data: encodedData,
      gas: 1000000,
    },
    ACCOUNT_PRIVATE_KEY
  );
  return signedTransaction;
};

const sendTransaction = async (signedTransaction) => {
  const receipt = await web3.eth.sendSignedTransaction(
    signedTransaction.rawTransaction
  );
  return receipt.status;
};

const signAndProcessTransaction = async (encodedData) => {
  try {
    const signedTransaction = await signTransaction(encodedData);
    const status = await sendTransaction(signedTransaction);
    return status;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  appData,
  signAndProcessTransaction,
};
