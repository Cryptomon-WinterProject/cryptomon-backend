exports.generateRandomNumber = function (size, multiplier) {
  return Array(size)
    .fill(0)
    .map(() => Math.floor(Math.random() * multiplier));
};
