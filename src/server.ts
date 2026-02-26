import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import formRoutes from './routes/form.routes';
import serviceRoutes from './routes/service.routes';
import publicRoutes from './routes/public.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/form', formRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/public', publicRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Backend is running' });
});

export default app;
