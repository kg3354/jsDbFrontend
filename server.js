
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const moment = require('moment-timezone');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors({
  origin: '*', // This is broad; consider restricting to specific origins for production
  methods: ['GET', 'POST'],
}));

app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

function isValidDate(dateString) {
  return moment(dateString, moment.ISO_8601, true).isValid();
}

app.get('/api/messages', async (req, res) => {
  const { guild, channel, start, end, parts } = req.query;

  if (!guild || !channel) {
    return res.status(400).send({
      message: 'Guild and Channel are required'
    });
  }

  if (!isValidDate(start) || !isValidDate(end)) {
    return res.status(400).send({
      message: 'Invalid date format'
    });
  }

  const startTime = moment(start).valueOf();
  const endTime = moment(end).valueOf();
  const numberOfParts = parseInt(parts) || 10; // default to 10 parts
  const interval = Math.floor((endTime - startTime) / numberOfParts);

  try {
    const filePath = path.join(__dirname, 'frontend/src/message_logs', guild, channel, 'message_log.json');
    if (fs.existsSync(filePath)) {
      const logData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const filteredMessages = logData.filter(msg => {
        const msgTime = moment(msg.timestamp).valueOf();
        return msgTime >= startTime && msgTime <= endTime;
      });

      const aggregatedMessages = Array.from({ length: numberOfParts }, (_, i) => {
        const startBucket = startTime + i * interval;
        const endBucket = startBucket + interval;
        return {
          timestamp: new Date(startBucket).toISOString(),
          messages: filteredMessages.filter(msg => {
            const msgTime = moment(msg.timestamp).valueOf();
            return msgTime >= startBucket && msgTime < endBucket;
          })
        };
      });

      res.json(aggregatedMessages);
    } else {
      res.status(404).send({
        message: 'Message log not found for the specified guild and channel'
      });
    }
  } catch (error) {
    console.error('Error fetching message logs:', error);
    res.status(500).send('Failed to fetch message logs.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
