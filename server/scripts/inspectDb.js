import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log(`Users count: ${users.length}`);
  users.forEach(u => console.log(`User: ${u._id} - ${u.email} - ${u.name}`));

  const tasks = await mongoose.connection.db.collection('tasks').find({}).toArray();
  console.log(`Tasks count: ${tasks.length}`);
  tasks.forEach(t => console.log(`Task: ${t._id} - title: "${t.title}" - status: ${t.status} - due: ${t.dueDate} - user: ${t.userId}`));

  const reminders = await mongoose.connection.db.collection('reminders').find({}).toArray();
  console.log(`Reminders count: ${reminders.length}`);
  reminders.forEach(r => console.log(`Reminder: ${r._id} - taskId: ${r.taskId} - scheduledAt: ${r.scheduledAt} - status: ${r.status} - user: ${r.userId}`));

  await mongoose.disconnect();
}

check().catch(console.error);
