export const LuaScripts = {
  chooseOrSwitchTeam: `
local gameKey = KEYS[1]
local playersKey = KEYS[2]
local leftSetKey = KEYS[3]
local rightSetKey = KEYS[4]
local wildSetKey = KEYS[5]
local onlineSetKey = KEYS[6]

local playerId = ARGV[1]
local targetTeam = ARGV[2]
local now = tonumber(ARGV[3]) or 0

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "OPEN" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Team switching is only allowed during OPEN phase" })
end

if targetTeam ~= "left" and targetTeam ~= "right" then
  return cjson.encode({ ok = false, code = "INVALID_TEAM", message = "Target team must be left or right" })
end

local rawPlayer = redis.call("HGET", playersKey, playerId)
if not rawPlayer then
  return cjson.encode({ ok = false, code = "PLAYER_NOT_FOUND", message = "Player not found" })
end

local player = cjson.decode(rawPlayer)
if player.status == "abandoned" then
  return cjson.encode({ ok = false, code = "MOVE_NOT_ALLOWED", message = "Player is marked abandoned" })
end

local previousTeam = player.team

if previousTeam == targetTeam and not player.wildcard then
  local leftCount = redis.call("SCARD", leftSetKey)
  local rightCount = redis.call("SCARD", rightSetKey)
  local wildCount = redis.call("SCARD", wildSetKey)
  local onlineCount = redis.call("SCARD", onlineSetKey)
  local totalCount = redis.call("HLEN", playersKey)
  return cjson.encode({
    ok = true,
    previousTeam = previousTeam,
    newTeam = targetTeam,
    counts = {
      left = leftCount,
      right = rightCount,
      chaos = wildCount,
      online = onlineCount,
      offline = math.max(0, totalCount - onlineCount),
      total = totalCount
    }
  })
end

if previousTeam == "left" then
  redis.call("SREM", leftSetKey, playerId)
elseif previousTeam == "right" then
  redis.call("SREM", rightSetKey, playerId)
elseif previousTeam == "chaos" or player.wildcard then
  redis.call("SREM", wildSetKey, playerId)
end

if targetTeam == "left" then
  redis.call("SADD", leftSetKey, playerId)
else
  redis.call("SADD", rightSetKey, playerId)
end

player.team = targetTeam
player.wildcard = false
player.lastSeen = now
redis.call("HSET", playersKey, playerId, cjson.encode(player))

local leftCount = redis.call("SCARD", leftSetKey)
local rightCount = redis.call("SCARD", rightSetKey)
local wildCount = redis.call("SCARD", wildSetKey)
local onlineCount = redis.call("SCARD", onlineSetKey)
local totalCount = redis.call("HLEN", playersKey)

return cjson.encode({
  ok = true,
  previousTeam = previousTeam,
  newTeam = targetTeam,
  counts = {
    left = leftCount,
    right = rightCount,
    chaos = wildCount,
    online = onlineCount,
    offline = math.max(0, totalCount - onlineCount),
    total = totalCount
  }
})
`,

  lockAndSnapshot: `
local gameKey = KEYS[1]
local playersKey = KEYS[2]
local leftSetKey = KEYS[3]
local rightSetKey = KEYS[4]
local wildSetKey = KEYS[5]
local onlineSetKey = KEYS[6]

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "OPEN" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Game can only be locked from OPEN phase" })
end

redis.call("HSET", gameKey, "phase", "LOCKING", "joinAllowed", "false")

local leftMembers = redis.call("SMEMBERS", leftSetKey)
local rightMembers = redis.call("SMEMBERS", rightSetKey)
local wildMembers = redis.call("SMEMBERS", wildSetKey)
local onlineCount = redis.call("SCARD", onlineSetKey)
local totalPlayers = redis.call("HLEN", playersKey)

local roster = {}
for i, id in ipairs(leftMembers) do
  table.insert(roster, { playerId = id, team = "left" })
end
for i, id in ipairs(rightMembers) do
  table.insert(roster, { playerId = id, team = "right" })
end
for i, id in ipairs(wildMembers) do
  table.insert(roster, { playerId = id, team = "chaos" })
end

return cjson.encode({
  ok = true,
  phase = "LOCKING",
  leftCount = #leftMembers,
  rightCount = #rightMembers,
  wildcardCount = #wildMembers,
  onlineCount = onlineCount,
  totalPlayers = totalPlayers,
  roster = roster
})
`,

  writePlan: `
local gameKey = KEYS[1]
local planKey = KEYS[2]
local movesKey = KEYS[3]

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "LOCKING" and phase ~= "BALANCING" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Balance plan can only be written during LOCKING or BALANCING phase" })
end

redis.call("HMSET", planKey,
  "targetLeft", ARGV[1],
  "targetRight", ARGV[2],
  "wildcardNeeded", ARGV[3],
  "needLeftToRight", ARGV[4],
  "needRightToLeft", ARGV[5],
  "remainingLeftToRight", ARGV[6],
  "remainingRightToLeft", ARGV[7],
  "wildcardPlayerId", ARGV[8],
  "wildcardApplied", ARGV[9],
  "status", ARGV[10]
)

local movesJson = ARGV[11]
if movesJson and movesJson ~= "[]" and movesJson ~= "" then
  redis.call("DEL", movesKey)
  local moves = cjson.decode(movesJson)
  for i, move in ipairs(moves) do
    redis.call("RPUSH", movesKey, cjson.encode(move))
  end
end

return cjson.encode({ ok = true })
`,

  applyVolunteerMove: `
local gameKey = KEYS[1]
local playersKey = KEYS[2]
local leftSetKey = KEYS[3]
local rightSetKey = KEYS[4]
local wildSetKey = KEYS[5]
local planKey = KEYS[6]
local movesKey = KEYS[7]
local onlineSetKey = KEYS[8]

local playerId = ARGV[1]
local targetTeam = ARGV[2]

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "BALANCING" then
  return cjson.encode({ ok = false, code = "MOVE_NOT_ALLOWED", message = "Volunteer moves are only allowed during BALANCING phase" })
end

local planFields = redis.call("HMGET", planKey, "remainingLeftToRight", "remainingRightToLeft", "wildcardNeeded", "wildcardPlayerId", "wildcardApplied")
local remL2R = tonumber(planFields[1]) or 0
local remR2L = tonumber(planFields[2]) or 0
local wildcardNeeded = tonumber(planFields[3]) or 0
local wildcardPlayerId = planFields[4]
local wildcardApplied = (planFields[5] == "1" or planFields[5] == "true")

local rawPlayer = redis.call("HGET", playersKey, playerId)
if not rawPlayer then
  return cjson.encode({ ok = false, code = "PLAYER_NOT_FOUND", message = "Player not found" })
end

local player = cjson.decode(rawPlayer)
if player.team == "chaos" or player.wildcard or (wildcardPlayerId and wildcardPlayerId ~= "" and wildcardPlayerId == playerId) then
  return cjson.encode({ ok = false, code = "MOVE_NOT_ALLOWED", message = "CHAOS PLAYER cannot volunteer" })
end

local expectedFrom
local expectedTo
if remL2R > 0 then
  expectedFrom = "left"
  expectedTo = "right"
elseif remR2L > 0 then
  expectedFrom = "right"
  expectedTo = "left"
else
  return cjson.encode({ ok = false, code = "MOVE_WOULD_OVERSHOOT", message = "Team balance already achieved" })
end

if player.team ~= expectedFrom or targetTeam ~= expectedTo then
  return cjson.encode({ ok = false, code = "MOVE_NOT_ALLOWED", message = "Only surplus-team players may volunteer toward deficit team" })
end

if expectedFrom == "left" then
  redis.call("SREM", leftSetKey, playerId)
  redis.call("SADD", rightSetKey, playerId)
  remL2R = remL2R - 1
  redis.call("HSET", planKey, "remainingLeftToRight", tostring(remL2R))
else
  redis.call("SREM", rightSetKey, playerId)
  redis.call("SADD", leftSetKey, playerId)
  remR2L = remR2L - 1
  redis.call("HSET", planKey, "remainingRightToLeft", tostring(remR2L))
end

player.team = expectedTo
redis.call("HSET", playersKey, playerId, cjson.encode(player))

local newStatus
if remL2R == 0 and remR2L == 0 then
  if wildcardNeeded == 1 and not wildcardApplied then
    newStatus = "needs_wildcard"
  else
    newStatus = "complete"
  end
else
  newStatus = "needs_moves"
end
redis.call("HSET", planKey, "status", newStatus)

local seq = redis.call("LLEN", movesKey) + 1
local moveObj = {
  kind = "team_switch",
  playerId = playerId,
  from = expectedFrom,
  to = expectedTo,
  reason = "volunteer",
  sequence = seq
}
redis.call("RPUSH", movesKey, cjson.encode(moveObj))

local leftCount = redis.call("SCARD", leftSetKey)
local rightCount = redis.call("SCARD", rightSetKey)
local wildCount = redis.call("SCARD", wildSetKey)
local onlineCount = redis.call("SCARD", onlineSetKey)
local totalCount = redis.call("HLEN", playersKey)

return cjson.encode({
  ok = true,
  move = moveObj,
  remainingLeftToRight = remL2R,
  remainingRightToLeft = remR2L,
  status = newStatus,
  counts = {
    left = leftCount,
    right = rightCount,
    chaos = wildCount,
    online = onlineCount,
    offline = math.max(0, totalCount - onlineCount),
    total = totalCount
  }
})
`,

  assignWildcard: `
local gameKey = KEYS[1]
local playersKey = KEYS[2]
local leftSetKey = KEYS[3]
local rightSetKey = KEYS[4]
local wildSetKey = KEYS[5]
local planKey = KEYS[6]
local movesKey = KEYS[7]
local onlineSetKey = KEYS[8]

local playerId = ARGV[1]
local reason = ARGV[2] or "wildcard"

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "BALANCING" and phase ~= "LOCKING" then
  return cjson.encode({ ok = false, code = "MOVE_NOT_ALLOWED", message = "Wildcard assignment only allowed during BALANCING or LOCKING" })
end

local wildcardNeeded = tonumber(redis.call("HGET", planKey, "wildcardNeeded")) or 0
if wildcardNeeded ~= 1 then
  return cjson.encode({ ok = false, code = "WILDCARD_NOT_ALLOWED", message = "This game does not require a wildcard" })
end

local existingWildCount = redis.call("SCARD", wildSetKey)
if existingWildCount > 0 then
  return cjson.encode({ ok = false, code = "WILDCARD_ALREADY_ASSIGNED", message = "Wildcard is already assigned" })
end

local rawPlayer = redis.call("HGET", playersKey, playerId)
if not rawPlayer then
  return cjson.encode({ ok = false, code = "PLAYER_NOT_FOUND", message = "Player not found" })
end

local player = cjson.decode(rawPlayer)
local fromTeam = player.team
if fromTeam ~= "left" and fromTeam ~= "right" then
  return cjson.encode({ ok = false, code = "INVALID_TEAM", message = "Wildcard candidate must be on left or right" })
end

if fromTeam == "left" then
  redis.call("SREM", leftSetKey, playerId)
else
  redis.call("SREM", rightSetKey, playerId)
end
redis.call("SADD", wildSetKey, playerId)

player.team = "chaos"
player.wildcard = true
redis.call("HSET", playersKey, playerId, cjson.encode(player))

local remL2R = tonumber(redis.call("HGET", planKey, "remainingLeftToRight")) or 0
local remR2L = tonumber(redis.call("HGET", planKey, "remainingRightToLeft")) or 0
local newStatus = (remL2R == 0 and remR2L == 0) and "complete" or "needs_moves"

redis.call("HMSET", planKey,
  "wildcardPlayerId", playerId,
  "wildcardApplied", "1",
  "status", newStatus
)

local seq = redis.call("LLEN", movesKey) + 1
local moveObj = {
  kind = "wildcard",
  playerId = playerId,
  from = fromTeam,
  to = "chaos",
  reason = reason,
  sequence = seq
}
redis.call("RPUSH", movesKey, cjson.encode(moveObj))

local leftCount = redis.call("SCARD", leftSetKey)
local rightCount = redis.call("SCARD", rightSetKey)
local wildCount = redis.call("SCARD", wildSetKey)
local onlineCount = redis.call("SCARD", onlineSetKey)
local totalCount = redis.call("HLEN", playersKey)

return cjson.encode({
  ok = true,
  move = moveObj,
  wildcardPlayerId = playerId,
  status = newStatus,
  counts = {
    left = leftCount,
    right = rightCount,
    chaos = wildCount,
    online = onlineCount,
    offline = math.max(0, totalCount - onlineCount),
    total = totalCount
  }
})
`,

  applyAutoBalance: `
local gameKey = KEYS[1]
local playersKey = KEYS[2]
local leftSetKey = KEYS[3]
local rightSetKey = KEYS[4]
local wildSetKey = KEYS[5]
local planKey = KEYS[6]
local movesKey = KEYS[7]
local onlineSetKey = KEYS[8]

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "BALANCING" then
  return cjson.encode({ ok = false, code = "MOVE_NOT_ALLOWED", message = "Auto balance can only be applied during BALANCING phase" })
end

local moves = cjson.decode(ARGV[1])

for i, move in ipairs(moves) do
  local rawPlayer = redis.call("HGET", playersKey, move.playerId)
  if not rawPlayer then
    return cjson.encode({ ok = false, code = "PLAYER_NOT_FOUND", message = "Player " .. move.playerId .. " not found" })
  end
  local player = cjson.decode(rawPlayer)
  if player.team ~= move.from then
    return cjson.encode({ ok = false, code = "CONCURRENT_MODIFICATION", message = "Player " .. move.playerId .. " is no longer on team " .. move.from })
  end
end

local wildcardPlayerId = redis.call("HGET", planKey, "wildcardPlayerId")
local wildcardNeeded = tonumber(redis.call("HGET", planKey, "wildcardNeeded")) or 0

for i, move in ipairs(moves) do
  if move.from == "left" then
    redis.call("SREM", leftSetKey, move.playerId)
  elseif move.from == "right" then
    redis.call("SREM", rightSetKey, move.playerId)
  end

  if move.to == "left" then
    redis.call("SADD", leftSetKey, move.playerId)
  elseif move.to == "right" then
    redis.call("SADD", rightSetKey, move.playerId)
  elseif move.to == "chaos" then
    redis.call("SADD", wildSetKey, move.playerId)
    wildcardPlayerId = move.playerId
  end

  local rawPlayer = redis.call("HGET", playersKey, move.playerId)
  local player = cjson.decode(rawPlayer)
  player.team = (move.to == "chaos") and "chaos" or move.to
  player.wildcard = (move.to == "chaos")
  redis.call("HSET", playersKey, move.playerId, cjson.encode(player))

  redis.call("RPUSH", movesKey, cjson.encode(move))
end

redis.call("HMSET", planKey,
  "remainingLeftToRight", "0",
  "remainingRightToLeft", "0",
  "wildcardApplied", (wildcardNeeded == 1) and "1" or "0",
  "wildcardPlayerId", wildcardPlayerId or "",
  "status", "complete"
)

local leftCount = redis.call("SCARD", leftSetKey)
local rightCount = redis.call("SCARD", rightSetKey)
local wildCount = redis.call("SCARD", wildSetKey)
local onlineCount = redis.call("SCARD", onlineSetKey)
local totalCount = redis.call("HLEN", playersKey)

return cjson.encode({
  ok = true,
  movesApplied = #moves,
  status = "complete",
  counts = {
    left = leftCount,
    right = rightCount,
    chaos = wildCount,
    online = onlineCount,
    offline = math.max(0, totalCount - onlineCount),
    total = totalCount
  }
})
`,

  tapIncrement: `
local gameKey = KEYS[1]
local playersKey = KEYS[2]
local leftScoreKey = KEYS[3]
local rightScoreKey = KEYS[4]
local playerId = ARGV[1]

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "RUNNING" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Tapping is only allowed during RUNNING phase" })
end

local rawPlayer = redis.call("HGET", playersKey, playerId)
if not rawPlayer then
  return cjson.encode({ ok = false, code = "PLAYER_NOT_FOUND", message = "Player not found" })
end

local player = cjson.decode(rawPlayer)
local team = player.team
if team ~= "left" and team ~= "right" then
  return cjson.encode({ ok = false, code = "INVALID_TEAM", message = "CHAOS PLAYER or unassigned player cannot score" })
end

local newScore
local leftScore
local rightScore

if team == "left" then
  newScore = redis.call("INCR", leftScoreKey)
  leftScore = newScore
  rightScore = tonumber(redis.call("GET", rightScoreKey)) or 0
else
  newScore = redis.call("INCR", rightScoreKey)
  rightScore = newScore
  leftScore = tonumber(redis.call("GET", leftScoreKey)) or 0
end

local seq = leftScore + rightScore

return cjson.encode({
  ok = true,
  team = team,
  newScore = newScore,
  scores = {
    left = leftScore,
    right = rightScore
  },
  seq = seq
})
`,

  rateLimitTap: `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1]) or 1000
local maxAllowed = tonumber(ARGV[2]) or 15

local current = redis.call("INCR", key)
if current == 1 then
  redis.call("PEXPIRE", key, windowMs)
end

if current > maxAllowed then
  local ttl = redis.call("PTTL", key)
  return cjson.encode({ ok = false, code = "RATE_LIMITED", message = "Rate limit exceeded", retryAfterMs = math.max(0, ttl) })
end

return cjson.encode({ ok = true, current = current, maxAllowed = maxAllowed })
`,

  startRunning: `
local gameKey = KEYS[1]
local leftScoreKey = KEYS[2]
local rightScoreKey = KEYS[3]
local now = tonumber(ARGV[1]) or 0

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "COUNTDOWN" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Can only start RUNNING from COUNTDOWN" })
end

local durationMs = tonumber(redis.call("HGET", gameKey, "durationMs")) or 30000
local startTime = now
local endTime = now + durationMs

redis.call("HMSET", gameKey,
  "phase", "RUNNING",
  "startTime", tostring(startTime),
  "endTime", tostring(endTime),
  "pausedAt", "",
  "pauseAccumMs", "0",
  "countdownEndsAt", ""
)

redis.call("SET", leftScoreKey, "0")
redis.call("SET", rightScoreKey, "0")

return cjson.encode({
  ok = true,
  phase = "RUNNING",
  startTime = startTime,
  endTime = endTime,
  durationMs = durationMs
})
`,

  pauseGame: `
local gameKey = KEYS[1]
local now = tonumber(ARGV[1]) or 0

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "RUNNING" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Game can only be paused during RUNNING phase" })
end

redis.call("HMSET", gameKey, "phase", "PAUSED", "pausedAt", tostring(now))

return cjson.encode({
  ok = true,
  phase = "PAUSED",
  pausedAt = now
})
`,

  resumeGame: `
local gameKey = KEYS[1]
local now = tonumber(ARGV[1]) or 0

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "PAUSED" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Game can only be resumed from PAUSED phase" })
end

local pausedAt = tonumber(redis.call("HGET", gameKey, "pausedAt")) or now
local delta = math.max(0, now - pausedAt)
local currentEndTime = tonumber(redis.call("HGET", gameKey, "endTime")) or now
local currentPauseAccum = tonumber(redis.call("HGET", gameKey, "pauseAccumMs")) or 0
local startTime = tonumber(redis.call("HGET", gameKey, "startTime"))
local durationMs = tonumber(redis.call("HGET", gameKey, "durationMs")) or 30000

local newEndTime = currentEndTime + delta
local newPauseAccum = currentPauseAccum + delta

redis.call("HMSET", gameKey,
  "phase", "RUNNING",
  "pausedAt", "",
  "pauseAccumMs", tostring(newPauseAccum),
  "endTime", tostring(newEndTime)
)

return cjson.encode({
  ok = true,
  phase = "RUNNING",
  startTime = startTime,
  endTime = newEndTime,
  pausedAt = cjson.null,
  pauseAccumMs = newPauseAccum,
  durationMs = durationMs
})
`,

  extendTime: `
local gameKey = KEYS[1]
local seconds = tonumber(ARGV[1]) or 0
local now = tonumber(ARGV[2]) or 0

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "RUNNING" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Time extension is only allowed while RUNNING" })
end

local currentEndTime = tonumber(redis.call("HGET", gameKey, "endTime")) or now
local newEndTime = currentEndTime + (seconds * 1000)

redis.call("HSET", gameKey, "endTime", tostring(newEndTime))

return cjson.encode({
  ok = true,
  seconds = seconds,
  endTime = newEndTime,
  serverNow = now
})
`,

  finishGame: `
local gameKey = KEYS[1]
local leftScoreKey = KEYS[2]
local rightScoreKey = KEYS[3]
local now = tonumber(ARGV[1]) or 0

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

local leftScore = tonumber(redis.call("GET", leftScoreKey)) or 0
local rightScore = tonumber(redis.call("GET", rightScoreKey)) or 0
local roundNumber = tonumber(redis.call("HGET", gameKey, "roundNumber")) or 1

if phase == "FINISHED" or phase == "RESULTS" then
  local winner = redis.call("HGET", gameKey, "winner") or "draw"
  return cjson.encode({
    ok = true,
    phase = "FINISHED",
    left = leftScore,
    right = rightScore,
    winner = winner,
    roundNumber = roundNumber
  })
end

if phase ~= "RUNNING" and phase ~= "PAUSED" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Game can only be finished from RUNNING or PAUSED phase" })
end

local winner = "draw"
if leftScore > rightScore then
  winner = "left"
elseif rightScore > leftScore then
  winner = "right"
end

redis.call("HMSET", gameKey, "phase", "FINISHED", "winner", winner)

return cjson.encode({
  ok = true,
  phase = "FINISHED",
  left = leftScore,
  right = rightScore,
  winner = winner,
  roundNumber = roundNumber
})
`,

  prepareNextRound: `
local gameKey = KEYS[1]
local leftScoreKey = KEYS[2]
local rightScoreKey = KEYS[3]
local leftSetKey = KEYS[4]
local rightSetKey = KEYS[5]
local wildSetKey = KEYS[6]
local onlineSetKey = KEYS[7]
local playersKey = KEYS[8]

local durationMs = tonumber(ARGV[1]) or 30000
local countdownMs = tonumber(ARGV[2]) or 3000
local now = tonumber(ARGV[3]) or 0

local phase = redis.call("HGET", gameKey, "phase")
if not phase then
  return cjson.encode({ ok = false, code = "GAME_NOT_FOUND", message = "Game not found" })
end

if phase ~= "FINISHED" and phase ~= "RESULTS" then
  return cjson.encode({ ok = false, code = "INVALID_PHASE", message = "Next round can only be prepared from FINISHED or RESULTS phase" })
end

local currentRound = tonumber(redis.call("HGET", gameKey, "roundNumber")) or 1
local nextRound = currentRound + 1
local countdownEndsAt = now + countdownMs

redis.call("HMSET", gameKey,
  "phase", "COUNTDOWN",
  "roundNumber", tostring(nextRound),
  "durationMs", tostring(durationMs),
  "countdownEndsAt", tostring(countdownEndsAt),
  "startTime", "",
  "endTime", "",
  "pausedAt", "",
  "pauseAccumMs", "0",
  "winner", ""
)

redis.call("SET", leftScoreKey, "0")
redis.call("SET", rightScoreKey, "0")

local leftCount = redis.call("SCARD", leftSetKey)
local rightCount = redis.call("SCARD", rightSetKey)
local wildCount = redis.call("SCARD", wildSetKey)
local onlineCount = redis.call("SCARD", onlineSetKey)
local totalCount = redis.call("HLEN", playersKey)

return cjson.encode({
  ok = true,
  phase = "COUNTDOWN",
  roundNumber = nextRound,
  countdownEndsAt = countdownEndsAt,
  durationMs = durationMs,
  counts = {
    left = leftCount,
    right = rightCount,
    chaos = wildCount,
    online = onlineCount,
    offline = math.max(0, totalCount - onlineCount),
    total = totalCount
  }
})
`,
} as const;

export type LuaScriptName = keyof typeof LuaScripts;
