const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running successfully at http://localhost:3000");
    });
  } catch (error) {
    console.log(`error Message:${error.message}`);
  }
};

initializeDbAndServer();

app.post("/create", async (request, response) => {
  const createUserTable = `CREATE TABLE user(
        username TEXT NOT NULL UNIQUE,
        password TEXT
    );`;
  await db.run(createUserTable);
  response.send("Table created Successfully");
});

app.delete("/delete", async (request, response) => {
  const createUserTable = `
  DROP TABLE user;`;
  await db.run(createUserTable);
  response.send("Table deleted Successfully");
});

app.post("/register", async (request, response) => {
  const { username, password } = request.body;
  const userExists = `
    SELECT
        *
    FROM
        user
    WHERE
        username='${username}';`;
  const dbUser = await db.get(userExists);
  if (dbUser === undefined) {
    if (password.length < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(request.body.password, 13);
      const newUser = `
                INSERT INTO 
                    user(username,password)
                VALUES
                    (
                        '${username}',
                        '${hashedPassword}'
                    );`;
      await db.run(newUser);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userExists = `
    SELECT
        *
    FROM
        user
    WHERE
        username='${username}';`;
  const dbUser = await db.get(userExists);
  if (dbUser !== undefined) {
    const passwordMatch = await bcrypt.compare(
      request.body.password,
      dbUser.password
    );
    if (passwordMatch === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET");
      response.send({ jwtToken });
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

const authenticateToken = (request, response, next) => {
  let jwToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwToken = authHeader.split(" ")[1];
  }
  if (jwToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwToken, "SECRET", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/states/", authenticateToken, async (request, response) => {
  const stateDetails = `
    SELECT
        state_id as stateId,state_name as stateName,population
    FROM
        state;`;
  const stateData = await db.all(stateDetails);
  response.send(stateData);
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateDetails = `
    SELECT
        state_id as stateId,state_name as stateName,population
    FROM
        state
    WHERE
        state_id=${stateId};`;
  const stateData = await db.get(stateDetails);
  response.send(stateData);
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrict = `
    INSERT INTO
        district(district_name,state_id,cases,cured,active,deaths)
    VALUES
    (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );
    `;
  await db.run(addDistrict);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictsData = `
    SELECT
        district_id as districtId,district_name as districtName,
        state_id as stateId,cases,cured,active,deaths
    FROM
        district
    WHERE
        district_id=${districtId};
    `;
    const districtData = await db.get(getDistrictsData);
    response.send(districtData);
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
    DELETE FROM
        district
    WHERE
        district_id=${districtId};
    `;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const setDistrictsData = `
    UPDATE 
        district
    SET
        district_name='${districtName}',
        state_id=${stateId},
        cured=${cured},
        active=${active},
        deaths=${deaths},
        cases=${cases}
    WHERE
        district_id=${districtId};
    `;
    await db.run(setDistrictsData);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateData = `
    SELECT
        sum(cases) as totalCases,
        sum(active) as totalActive,
        sum(cured) as totalCured,
        sum(deaths) as totalDeaths
    FROM
        district
    WHERE
        state_id=${stateId};
    `;
    const stateData = await db.get(getStateData);
    response.send(stateData);
  }
);

module.exports = app;
