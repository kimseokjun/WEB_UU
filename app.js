const express = require('express');
const bodyParser = require('body-parser');
const { connectDB } = require('./config/database');
const { PORT } = require('./config/env');
const recipeRoutes = require('./routes/recipeRoutes');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static(__dirname));

// 데이터베이스 연결
connectDB().catch(console.error);

// 라우트
app.use('/api/recipes', recipeRoutes);

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT}에서 실행 중입니다.`);
});