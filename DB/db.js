const mongoose = require("mongoose");

const connectDB = () => {
  mongoose.connect(
    "mongodb+srv://vishal7738639800:LBQrcTMHAkbKHA6b@face-attandance.zshkexk.mongodb.net/"
  );

  console.log("Connected to database successfully");
};

// vishal7738639800
// LBQrcTMHAkbKHA6b
module.exports = connectDB;
