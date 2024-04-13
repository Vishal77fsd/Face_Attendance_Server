const express = require("express");
const app = express();
const PORT = 3000;
const cors = require("cors");
const bodyParser = require("body-parser");
const md5 = require("md5");
const base64Img = require("base64-img");
const Employee = require("./Schema/EmployeeSchema");
const Admin = require("./Schema/Admin");
const connectDB = require("./DB/db");
const path = require("path");
const canvas = require("canvas");
const faceapi = require("face-api.js");
require("dotenv").config();
let faces = null;

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

connectDB();
app.use(cors({}));
app.use(bodyParser.json());

// Loading Models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromDisk(path.join(__dirname, "models")),
  faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, "models")),
  faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, "models")),
  faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(__dirname, "models")),
])
  .then(() => {
    console.log("Models Added");
  })
  .then(() => {
    faces = getDesc();
    faces
      .then((result) => {
        faces = result;
      })
      .catch((err) => {
        console.log("ABC", err);
      });
  });

// Serving static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// app.use("/labels", express.static(path.join(__dirname, "labels")));

app.get("/", (req, res) => {
  res.send("hello world");
});

// handle login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await Admin.findOne({ email: email, password: password });

  console.log(result);
  if (result) {
    return res.send(result).status(200);
  } else {
    return res.send("Admin Not Found").status(200);
  }
});
function base64ToArrayBuffer(base64) {
  const myBuffer = Buffer.from(base64, "base64");
  return myBuffer;
}

app.post("/upload", async (req, res) => {
  const { name, img } = req.body;
  const [first, middle, last] = name.split(" ");
  const date = md5(new Date());

  const filepath = base64Img.imgSync(img, "./uploads/", date);
  console.log(filepath);
  const imgage = await canvas.loadImage(filepath);
  const detections = await faceapi
    .detectSingleFace(imgage)
    .withFaceLandmarks()
    .withFaceDescriptor();

  console.log(detections);
  if (detections !== undefined) {
    const newEmployee = new Employee({
      id: date,
      firstname: first,
      middlename: middle,
      lastname: last,
      img: filepath,
      base64Img: img,
    });
    const employee = await newEmployee.save();
    return res.send(employee.firstname).status(200);
  } else {
    return res.send("Face Not Detected").status(200);
  }
});

// Check In Post
app.post("/checkin", async (req, res) => {
  const { imageSrc } = req.body;
  const date = md5(new Date());

  const filepath = base64Img.imgSync(imageSrc, "./checkin/", date);
  // console.log(filepath);
  const img = await canvas.loadImage(filepath);
  const detections = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();
  console.log(detections);

  if (detections === undefined) {
    return res.send("Face Not Detected").status(200);
  }

  console.log(faces);
  // Load face matcher to find the matching face
  const faceMatcher = new faceapi.FaceMatcher(faces, 0.6);
  const result = faceMatcher.findBestMatch(detections.descriptor);

  const employee = await Employee.findOne({ firstname: `${result._label}` });

  const todayDateString = new Date().toLocaleDateString();
  const attendanceRecordIndex = employee.attendance.findIndex(
    (record) => Object.keys(record)[0] === todayDateString
  );

  // If todays date is not in the array
  if (attendanceRecordIndex == -1) {
    employee.attendance.push({
      [`${new Date().toLocaleDateString()}`]: {
        checkIn: new Date().toLocaleTimeString(),
        checkOut: null,
      },
    });
    employee.save();
  } else {
    console.log("User already checked In");
  }

  res.send(result).status(200);
});

// Check Out Post
app.post("/checkout", async (req, res) => {
  const { imageSrc } = req.body;
  const date = md5(new Date());

  const filepath = await base64Img.imgSync(imageSrc, "./checkin/", date);
  // console.log(filepath);
  const img = await canvas.loadImage(filepath);
  const detections = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (detections === undefined) {
    console.log("Face Not Detected");
    return res.send("Face Not Detected").status(200);
  }
  // Loading faces
  // const faces = await getDesc();
  // console.log("faces", faces);
  // Load face matcher to find the matching face
  const faceMatcher = new faceapi.FaceMatcher(faces, 0.6);
  console.log(faceMatcher);

  const result = faceMatcher.findBestMatch(detections.descriptor);
  console.log(result);

  const employee = await Employee.findOne({ firstname: `${result._label}` });

  const todayDateString = new Date().toLocaleDateString();
  const attendanceRecordIndex = employee.attendance.findIndex(
    (record) => Object.keys(record)[0] === todayDateString
  );

  if (attendanceRecordIndex !== -1) {
    const attendanceRecord = employee.attendance[attendanceRecordIndex];
    if (attendanceRecord[todayDateString].checkOut != null) {
      console.log("User already checked out.");
    } else {
      console.log("User just checked out.");
      attendanceRecord[todayDateString].checkOut =
        new Date().toLocaleTimeString();
      employee.attendance.set(attendanceRecordIndex, attendanceRecord);
    }
  } else {
    console.log("No attendance record found for today. First Check In");
  }

  employee.save();
  res.send("Employee Checkout successfully").status(200);
});

app.get("/employee/:id", async (req, res) => {
  const id = req.params.id;
  const user = await Employee.findById(id);
  console.log(user);
  return res.send(user).status(200);
});

// Update data
app.put("/employee/update/:id", async (req, res) => {
  const id = req.params.id;
  let { firstName, middleName, lastName } = req.body.data;

  let employee = await Employee.findOneAndUpdate(
    { _id: id },
    { firstname: firstName, middlename: middleName, lastname: lastName }
  );
  res.send("Employee Updated Successfully");
});

// Getting face descriptors from database
const getDescriptorsFromDB = async (req, res) => {
  console.log("before GetDescriptorsFromDB");
  // Getting all the employees
  const employees = await Employee.find({});
  return Promise.all(
    employees.map(async (employee) => {
      const spread = employee.img.split("\\");
      let descriptions = [];
      // FilePath Here
      const filepath = path.join(__dirname, "uploads");
      console.log(filepath);
      // Getting person face from file
      const img = await canvas.loadImage(`${filepath}/${spread[1]}`);
      const detections = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
      // console.log(detections);
      descriptions.push(detections.descriptor);

      console.log("After GetDescriptorsFromDB");
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
// const ress = getDesc();
// console.log(ress);

// Return all employees
app.get("/employees", async (req, res) => {
  const employees = await Employee.find({});
  res.send(employees);
});

// Delete Employee with id
app.post("/employees/delete/:id", async (req, res) => {
  const id = req.params.id;
  const result = await Employee.findOneAndDelete({ id: id });
  res.send(result);
});

app.listen(PORT, () => {
  console.log("Server is running on PORT:3000");
});
