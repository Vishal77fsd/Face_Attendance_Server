const mongoose = require("mongoose");
const { Schema } = mongoose;

const employeeSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    firstname: String,
    middlename: String,
    lastname: String,
    img: String,
    base64Img: String,
    date: Array,
  },
  { timestamps: true }
);

const Employee = mongoose.model("Employee", employeeSchema);

module.exports = Employee;
