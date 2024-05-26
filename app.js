const express = require('express')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
app.use(express.json())
module.exports = app

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const conversionToREsponseObj = item => {
  return {
    stateId: item.state_id,
    stateName: item.state_name,
    population: item.population,
  }
}

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  console.log(jwtToken)
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'secretkey', async (err, payload) => {
      if (err) {
        response.send('Invalid JWT Token')
      } else {
        console.log(jwtToken)
        next()
      }
    })
  }
}

// API 1 LOGIN
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(userQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = await jwt.sign(payload, 'SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API 2
app.get('/states/', authenticateToken, async (request, response) => {
  try {
    const getStatesQuery = `SELECT * FROM state`
    const result = await db.all(getStatesQuery)
    response.send(result.map(item => conversionToREsponseObj(item)))
    console.log(result)
  } catch (e) {
    console.log('get api error : ' + e)
  }
})

//API 3
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId}`
  const result = await db.get(getStateQuery)
  response.send(conversionToREsponseObj(result))
})

//API 4
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const addDistrictQuery = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}')
  `
  await db.run(addDistrictQuery)
  response.send('District Successfully Added')
})

//API 5
app.get('/districts/:districtId/', authenticateToken, async (request, response) => {
  const {districtId} = request.params
  const getDistrictQuery = `SELECT * FROM district WHERE district_id = '${districtId}'`
  const result = await db.get(getDistrictQuery)
  response.send(result)
  console.log(result)
})

//API 6
app.delete('/districts/:districtId/',authenticateToken, async (request, response) => {
  const {districtId} = request.params
  const deleteQuery = `DELETE FROM district WHERE district_id = '${districtId}'`
  await db.run(deleteQuery)
  response.send('District Removed')
})

//API 7
app.put('/districts/:districtId/',authenticateToken,  async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const updateDistrictQuery = `
    UPDATE district
    SET district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = '${districtId}'
  `
  const result = await db.run(updateDistrictQuery)
  response.send('District Details Updated')
})

//API 8
app.get('/states/:stateId/stats/',authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateStats = `
    SELECT SUM(cases) as totalCases,
          SUM(cured) as totalCured,
          SUM(active) as totalActive,
          SUM(deaths) as totalDeaths
    FROM district WHERE state_id = '${stateId}' ;`
  const result = await db.all(getStateStats)
  response.send(result)
})
