const express = require("express");
const app = express();
const PORT = 3000;
const cors = require("cors");
const bodyParser = require("body-parser");
const md5 = require("md5");
const base64Img = require("base64-img");
const Employee = require("./Schema/EmployeeSchema");
const connectDB = require("./DB/db");
const path = require("path");
const canvas = require("canvas");
const faceapi = require("face-api.js");

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

connectDB();
app.use(cors());
app.use(bodyParser.json());

// Loading Models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromDisk(path.join(__dirname, "models")),
  faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, "models")),
  faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, "models")),
  faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(__dirname, "models")),
]).then(() => {
  console.log("Models Added");
});

// Serving static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// app.use("/labels", express.static(path.join(__dirname, "labels")));

app.get("/", (req, res) => {
  res.send("hello world");
});

function base64ToArrayBuffer(base64) {
  const myBuffer = Buffer.from(base64, "base64");
  return myBuffer;
}

app.post("/upload", async (req, res) => {
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
});

app.post("/checkin", async (req, res) => {
  const { imageSrc } = req.body;
  const date = md5(new Date());

  const filepath = await base64Img.imgSync(imageSrc, "./checkin/", date);
  // console.log(filepath);
  const img = await canvas.loadImage(filepath);
  const detections = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();

  // Loading face
  const faces = await getDesc();
  console.log("faces", faces);
  // Load face matcher to find the matching face
  const faceMatcher = new faceapi.FaceMatcher(faces, 0.6);
  console.log(faceMatcher);

  const result = faceMatcher.findBestMatch(detections.descriptor);
  console.log(result);

  const employee = await Employee.findOne({ firstname: `${result._label}` });
  // console.log(employee);
  const data = {
    date: new Date().toLocaleDateString(),
    checkIn: new Date().toLocaleTimeString(),
  };
  employee.date.push(data);
  employee.save();
  res.send(result).status(200);
});
// console.log(new Date().toLocaleTimeString());

// Getting face descriptors from database
const getDescriptorsFromDB = async (req, res) => {
  console.log("GetDescriptorsFromDB");
  // Getting all the employees
  const employees = await Employee.find({});
  return Promise.all(
    employees.map(async (employee) => {
      const spread = employee.img.split("\\");
      let descriptions = [];
      // FilePath Here
      const filepath = path.join(__dirname, "uploads");
      // Getting person face from file
      const img = await canvas.loadImage(`${filepath}/${spread[1]}`);
      const detections = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
      // console.log(detections);
      descriptions.push(detections.descriptor);

      // Returning all the descriptors with label in it
      return new faceapi.LabeledFaceDescriptors(
        employee.firstname,
        descriptions
      );
    })
  );
};

// Calling getDesc Function
async function getDesc() {
  const res = await getDescriptorsFromDB();
  // console.log(res);
  return res;
}
const ress = getDesc();
console.log(ress);

app.listen(PORT, () => {
  console.log("Server is running on PORT:3000");
});
