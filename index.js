const express = require("express");
const app = express();
const PORT = 3000;
const cors = require("cors");
const bodyParser = require("body-parser");
const md5 = require("md5");
const base64Img = require("base64-img");
const Employee = require("./Schema/EmployeeSchema");
const connectDB = require("./DB/db");
const faceapi = require("face-api.js");
const fs = require("fs");
const path = require("path");
console.log(__dirname);

connectDB();
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("hello world");
});

app.post("/upload", async (req, res) => {
  if (true) {
    // Faces are same
    const { name, base64Img1 } = req.body;

    // Getting all employees present in database
    const employees = await getAllEmployees();
    employees.map(async (employee) => {
      const base64Img2 = employee.base64Img;

      const image1 = await faceapi.computeFaceDescriptor(base64Img1);
      const image2 = await faceapi.computeFaceDescriptor(base64Img2);

      // Extract the face descriptors from the detected faces.
      const descriptor1 = image1.descriptor;
      const descriptor2 = image2.descriptor;

      // Compare the face descriptors using the Euclidean distance.
      const distance = faceapi.euclideanDistance(descriptor1, descriptor2);

      // Determine if the faces are similar based on the distance.
      if (distance < 0.5) {
        console.log("The faces are similar.");
      } else {
        console.log("The faces are not similar.");
      }
    });

    res.json({ message: "Employee Already Present In The Database" });
  } else {
    // If faces are not same
    const { name, img } = req.body;
    const [first, middle, last] = name.split(" ");
    const date = md5(new Date());

    const filepath = await base64Img.imgSync(img, "./uploads/", date);

    const newEmployee = new Employee({
      id: date,
      firstname: first,
      middlename: middle,
      lastname: last,
      img: filepath,
      base64Img: img,
    });

    const employee = await newEmployee.save();

    res.send(employee.firstname).status(200);
  }
});

const getAllEmployees = async () => {
  const employees = await Employee.find({});

  return employees;
};
app.listen(PORT, () => {
  console.log("Server is running on PORT:3000");
});
