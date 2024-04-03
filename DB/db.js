const mongoose = require("mongoose");

const connectDB = () => {
  mongoose.connect(process.env.DB);

  console.log("Connected to database successfully");
};

// vishal7738639800
// LBQrcTMHAkbKHA6b
module.exports = connectDB;
