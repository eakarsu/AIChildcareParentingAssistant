require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Starting seed...\n');

    // ─── DROP TABLES ───
    await client.query(`
      DROP TABLE IF EXISTS shopping_lists CASCADE;
      DROP TABLE IF EXISTS playdates CASCADE;
      DROP TABLE IF EXISTS allergy_logs CASCADE;
      DROP TABLE IF EXISTS chores CASCADE;
      DROP TABLE IF EXISTS photo_memories CASCADE;
      DROP TABLE IF EXISTS tooth_records CASCADE;
      DROP TABLE IF EXISTS daily_routines CASCADE;
      DROP TABLE IF EXISTS caregiver_logs CASCADE;
      DROP TABLE IF EXISTS expenses CASCADE;
      DROP TABLE IF EXISTS diaper_records CASCADE;
      DROP TABLE IF EXISTS learning_resources CASCADE;
      DROP TABLE IF EXISTS emergency_contacts CASCADE;
      DROP TABLE IF EXISTS appointments CASCADE;
      DROP TABLE IF EXISTS medications CASCADE;
      DROP TABLE IF EXISTS journal_entries CASCADE;
      DROP TABLE IF EXISTS behavioral_notes CASCADE;
      DROP TABLE IF EXISTS vaccinations CASCADE;
      DROP TABLE IF EXISTS growth_records CASCADE;
      DROP TABLE IF EXISTS feeding_records CASCADE;
      DROP TABLE IF EXISTS sleep_records CASCADE;
      DROP TABLE IF EXISTS health_records CASCADE;
      DROP TABLE IF EXISTS activities CASCADE;
      DROP TABLE IF EXISTS milestones CASCADE;
      DROP TABLE IF EXISTS children CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log('Dropped all tables.');

    // ─── CREATE TABLES ───
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE children (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender VARCHAR(20),
        blood_type VARCHAR(10),
        allergies TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE milestones (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        achieved_date DATE,
        expected_age_months INTEGER,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE activities (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        scheduled_date TIMESTAMP,
        duration_minutes INTEGER,
        status VARCHAR(50) DEFAULT 'planned',
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE health_records (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        record_type VARCHAR(100) NOT NULL,
        record_date DATE,
        provider VARCHAR(255),
        severity VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE sleep_records (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        sleep_start TIMESTAMP,
        sleep_end TIMESTAMP,
        quality VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE feeding_records (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        meal_type VARCHAR(100) NOT NULL,
        food_items TEXT,
        quantity VARCHAR(100),
        meal_time TIMESTAMP,
        calories INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE growth_records (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        measured_date DATE NOT NULL,
        height_cm DECIMAL(5,2),
        weight_kg DECIMAL(5,2),
        head_circumference_cm DECIMAL(5,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE vaccinations (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        vaccine_name VARCHAR(255) NOT NULL,
        dose_number INTEGER,
        administered_date DATE,
        next_due_date DATE,
        provider VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE behavioral_notes (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        behavior TEXT NOT NULL,
        context TEXT,
        observed_date DATE,
        mood VARCHAR(50),
        severity VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE journal_entries (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        mood VARCHAR(50),
        entry_date DATE,
        tags TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE medications (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        dosage VARCHAR(100) NOT NULL,
        frequency VARCHAR(100),
        start_date DATE,
        end_date DATE,
        prescribed_by VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE appointments (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        provider VARCHAR(255),
        location VARCHAR(255),
        appointment_date TIMESTAMP NOT NULL,
        appointment_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'scheduled',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE emergency_contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        relationship VARCHAR(100),
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        address TEXT,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE learning_resources (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        resource_type VARCHAR(100),
        url TEXT,
        age_range_start INTEGER,
        age_range_end INTEGER,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE diaper_records (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        change_time TIMESTAMP NOT NULL,
        type VARCHAR(50) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        child_id INTEGER REFERENCES children(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        category VARCHAR(100),
        expense_date DATE,
        payment_method VARCHAR(100),
        receipt_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE caregiver_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        caregiver_name VARCHAR(255) NOT NULL,
        relationship VARCHAR(100),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        activities TEXT,
        notes TEXT,
        rating INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE daily_routines (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        time_of_day VARCHAR(50),
        scheduled_time TIME,
        duration_minutes INTEGER,
        category VARCHAR(100),
        days_of_week VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE tooth_records (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        tooth_name VARCHAR(100) NOT NULL,
        tooth_position VARCHAR(50),
        event_type VARCHAR(50) NOT NULL,
        event_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE photo_memories (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        memory_date DATE,
        category VARCHAR(100),
        location VARCHAR(255),
        people_in_photo TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE chores (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        frequency VARCHAR(50),
        assigned_date DATE,
        due_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        reward TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE allergy_logs (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        allergen VARCHAR(255) NOT NULL,
        severity VARCHAR(50),
        reaction TEXT,
        first_observed DATE,
        last_reaction DATE,
        treatment TEXT,
        is_confirmed BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE playdates (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        friend_name VARCHAR(255) NOT NULL,
        friend_age VARCHAR(50),
        playdate_date DATE,
        start_time TIME,
        end_time TIME,
        location VARCHAR(255),
        activity TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE shopping_lists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        child_id INTEGER REFERENCES children(id) ON DELETE SET NULL,
        item_name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        quantity VARCHAR(100),
        priority VARCHAR(50),
        is_purchased BOOLEAN DEFAULT false,
        estimated_cost DECIMAL(10,2),
        store VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created all tables.');

    // ─── DEMO USER ───
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      ['Sarah Johnson', 'demo@childcare.com', hash]
    );
    const userId = userResult.rows[0].id;
    console.log('Created demo user (demo@childcare.com / password123)');

    // ─── CHILDREN ───
    const childResult = await client.query(
      `INSERT INTO children (user_id, name, date_of_birth, gender, blood_type, allergies, notes) VALUES
        ($1, 'Emma Johnson', '2023-03-15', 'Female', 'A+', 'Mild peanut allergy', 'Loves animals and painting. Very social and curious.'),
        ($1, 'Liam Johnson', '2025-01-10', 'Male', 'O+', 'None known', 'Happy baby, loves music and being held. Starting to explore solids.')
      RETURNING id`,
      [userId]
    );
    const emmaId = childResult.rows[0].id;
    const liamId = childResult.rows[1].id;
    console.log('Created 2 children: Emma & Liam');

    // ─── MILESTONES ───
    await client.query(`
      INSERT INTO milestones (child_id, title, description, category, achieved_date, expected_age_months, status) VALUES
        (${emmaId}, 'First Smile', 'Emma gave her first real social smile while looking at mom', 'Social', '2023-05-10', 2, 'achieved'),
        (${emmaId}, 'First Laugh', 'Laughed out loud during peek-a-boo game', 'Social', '2023-07-20', 4, 'achieved'),
        (${emmaId}, 'Rolling Over', 'Rolled from tummy to back during tummy time', 'Motor', '2023-08-01', 4, 'achieved'),
        (${emmaId}, 'Sitting Up Unassisted', 'Sat up without support for over a minute', 'Motor', '2023-09-20', 6, 'achieved'),
        (${emmaId}, 'Crawling', 'Started army crawling, then proper hands-and-knees crawling', 'Motor', '2023-11-15', 8, 'achieved'),
        (${emmaId}, 'First Steps', 'Took first three independent steps between couch and coffee table', 'Motor', '2024-03-10', 12, 'achieved'),
        (${emmaId}, 'First Words - Mama', 'Said "mama" clearly and intentionally reaching for mom', 'Language', '2024-01-20', 10, 'achieved'),
        (${emmaId}, 'First Words - Dada', 'Said "dada" when dad came home from work', 'Language', '2024-02-05', 11, 'achieved'),
        (${emmaId}, 'Pointing at Objects', 'Points at things she wants and looks back at parent for response', 'Cognitive', '2024-01-10', 10, 'achieved'),
        (${emmaId}, 'Waving Bye-Bye', 'Waves goodbye when someone leaves the room', 'Social', '2024-02-28', 11, 'achieved'),
        (${emmaId}, 'Clapping Hands', 'Claps along to music and when excited', 'Motor', '2024-01-15', 10, 'achieved'),
        (${emmaId}, 'Self-Feeding with Spoon', 'Can use a spoon to eat yogurt with minimal spilling', 'Motor', '2024-09-01', 18, 'achieved'),
        (${emmaId}, 'Drinking from Cup', 'Drinks from an open cup with both hands', 'Motor', '2024-06-15', 15, 'achieved'),
        (${emmaId}, 'Stacking Blocks', 'Can stack 6 blocks into a tower before knocking it down', 'Cognitive', '2024-12-01', 21, 'achieved'),
        (${emmaId}, 'Drawing Scribbles', 'Holds crayon in fist and scribbles on paper with enthusiasm', 'Motor', '2025-01-10', 22, 'achieved'),
        (${emmaId}, 'Following Two-Step Instructions', 'Can follow "pick up the ball and bring it to me"', 'Cognitive', '2025-06-01', 27, 'achieved'),
        (${emmaId}, 'Running', 'Runs confidently around the yard without falling', 'Motor', '2025-03-15', 24, 'achieved'),
        (${liamId}, 'First Smile', 'Smiled at mom during feeding time', 'Social', '2025-03-05', 2, 'achieved'),
        (${liamId}, 'Holding Head Up', 'Holds head steady during tummy time', 'Motor', '2025-04-10', 3, 'achieved'),
        (${liamId}, 'Cooing and Gurgling', 'Makes cooing sounds when talked to', 'Language', '2025-03-20', 2, 'achieved')
    `);
    console.log('Inserted 20 milestones');

    // ─── ACTIVITIES ───
    await client.query(`
      INSERT INTO activities (child_id, title, description, category, scheduled_date, duration_minutes, status, location) VALUES
        (${emmaId}, 'Morning Storytime', 'Reading "The Very Hungry Caterpillar" and other picture books', 'Education', '2026-03-18 09:00:00', 30, 'completed', 'Living Room'),
        (${emmaId}, 'Park Playground Visit', 'Playing on slides, swings, and sandbox at Lincoln Park', 'Outdoor', '2026-03-18 10:30:00', 60, 'planned', 'Lincoln Park'),
        (${emmaId}, 'Finger Painting', 'Creating artwork with non-toxic finger paints on large paper', 'Art', '2026-03-17 14:00:00', 45, 'completed', 'Kitchen'),
        (${emmaId}, 'Music Class', 'Weekly toddler music class with singing and instruments', 'Education', '2026-03-19 11:00:00', 45, 'planned', 'Harmony Music Studio'),
        (${emmaId}, 'Swimming Lesson', 'Parent-child swim class at community pool', 'Sports', '2026-03-20 09:30:00', 30, 'planned', 'Community Pool'),
        (${emmaId}, 'Nature Walk', 'Exploring the nature trail, collecting leaves and rocks', 'Outdoor', '2026-03-16 10:00:00', 45, 'completed', 'Riverside Trail'),
        (${emmaId}, 'Building Blocks', 'Constructing towers and bridges with wooden blocks', 'Play', '2026-03-18 15:00:00', 30, 'planned', 'Playroom'),
        (${emmaId}, 'Sensory Play', 'Playing with water beads, kinetic sand, and textured objects', 'Education', '2026-03-17 10:00:00', 40, 'completed', 'Backyard'),
        (${emmaId}, 'Dance Party', 'Dancing to favorite nursery rhymes and kids songs', 'Music', '2026-03-15 16:00:00', 20, 'completed', 'Living Room'),
        (${emmaId}, 'Cooking Together', 'Making simple fruit salad with safe kid-friendly tasks', 'Life Skills', '2026-03-16 12:00:00', 30, 'completed', 'Kitchen'),
        (${emmaId}, 'Garden Exploration', 'Watering plants and looking at bugs in the garden', 'Outdoor', '2026-03-15 10:00:00', 25, 'completed', 'Backyard Garden'),
        (${emmaId}, 'Library Visit', 'Attending toddler reading hour and picking new books', 'Education', '2026-03-14 10:30:00', 60, 'completed', 'Public Library'),
        (${emmaId}, 'Puzzle Time', 'Working on age-appropriate wooden puzzles', 'Cognitive', '2026-03-18 14:00:00', 20, 'planned', 'Playroom'),
        (${emmaId}, 'Bike Riding', 'Practicing on balance bike in the driveway', 'Sports', '2026-03-19 16:00:00', 30, 'planned', 'Driveway'),
        (${emmaId}, 'Playdate with Friends', 'Playing with neighbor kids - sharing toys and cooperative play', 'Social', '2026-03-20 14:00:00', 90, 'planned', 'Backyard'),
        (${liamId}, 'Tummy Time', 'Supervised tummy time with colorful toys', 'Motor Development', '2026-03-18 09:00:00', 15, 'planned', 'Living Room'),
        (${liamId}, 'Baby Massage', 'Gentle massage with baby-safe lavender oil', 'Wellness', '2026-03-18 19:00:00', 15, 'planned', 'Nursery'),
        (${liamId}, 'Sensory Rattles', 'Playing with different textured rattles and crinkle toys', 'Sensory', '2026-03-17 11:00:00', 20, 'completed', 'Playmat'),
        (${liamId}, 'Baby Music Time', 'Listening to lullabies and gentle classical music', 'Music', '2026-03-18 12:00:00', 20, 'planned', 'Nursery'),
        (${liamId}, 'Mirror Play', 'Exploring reflections in baby-safe mirror', 'Cognitive', '2026-03-16 10:00:00', 10, 'completed', 'Nursery')
    `);
    console.log('Inserted 20 activities');

    // ─── HEALTH RECORDS ───
    await client.query(`
      INSERT INTO health_records (child_id, title, description, record_type, record_date, provider, severity, notes) VALUES
        (${emmaId}, '12-Month Well-Child Checkup', 'Routine checkup at 12 months. All developmental milestones on track.', 'checkup', '2024-03-15', 'Dr. Rebecca Chen', 'none', 'Height and weight in 60th percentile. No concerns.'),
        (${emmaId}, 'Ear Infection - Left Ear', 'Complained of ear pain, diagnosed with otitis media in left ear', 'illness', '2024-06-20', 'Dr. Rebecca Chen', 'moderate', 'Prescribed amoxicillin for 10 days. Follow-up in 2 weeks.'),
        (${emmaId}, 'Mild Fever Episode', 'Temperature of 101.2F after daycare. Likely viral.', 'illness', '2024-09-05', 'Dr. Rebecca Chen', 'mild', 'Tylenol administered. Fever resolved in 24 hours.'),
        (${emmaId}, 'Allergic Reaction - Peanuts', 'Mild hives appeared after eating food containing peanuts at a party', 'allergy', '2024-11-12', 'Dr. Rebecca Chen', 'moderate', 'Benadryl given. Allergy confirmed by subsequent testing. EpiPen prescribed.'),
        (${emmaId}, 'First Dental Checkup', 'First visit to pediatric dentist. 16 teeth present, all healthy.', 'dental', '2024-09-20', 'Dr. James Park, DDS', 'none', 'Fluoride varnish applied. No cavities. Next visit in 6 months.'),
        (${emmaId}, 'Eye Exam', 'Routine vision screening. Normal results for age.', 'vision', '2025-03-15', 'Dr. Lisa Wong, OD', 'none', 'Vision appears normal. No concerns about tracking or focus.'),
        (${emmaId}, 'Cold Symptoms', 'Runny nose, mild cough, and sneezing for 3 days', 'illness', '2025-01-10', 'Dr. Rebecca Chen', 'mild', 'Common cold. Rest, fluids, and honey for cough recommended.'),
        (${emmaId}, 'Stomach Bug', 'Vomiting and diarrhea for 2 days. Likely norovirus from daycare outbreak.', 'illness', '2025-04-22', 'Dr. Rebecca Chen', 'moderate', 'Pedialyte for hydration. Bland diet. Resolved in 3 days.'),
        (${emmaId}, 'Skin Rash', 'Unexplained rash on torso, diagnosed as roseola', 'illness', '2024-08-15', 'Dr. Rebecca Chen', 'mild', 'Rash appeared after 3 days of fever. Self-resolving.'),
        (${emmaId}, 'Vaccination Reaction', 'Low-grade fever and fussiness after 18-month vaccines', 'reaction', '2024-09-15', 'Dr. Rebecca Chen', 'mild', 'Normal reaction. Tylenol given. Resolved within 24 hours.'),
        (${emmaId}, '24-Month Well-Child Checkup', 'Routine 2-year checkup. Development excellent across all domains.', 'checkup', '2025-03-15', 'Dr. Rebecca Chen', 'none', 'Speech advanced for age. Running and climbing well. Social skills strong.'),
        (${emmaId}, 'Hearing Screening', 'Routine hearing test at pediatrician office', 'screening', '2025-03-15', 'Dr. Rebecca Chen', 'none', 'Passed hearing screening in both ears.'),
        (${emmaId}, 'Blood Test - Lead Screening', 'Routine lead screening blood draw at 12 months', 'lab', '2024-03-15', 'Quest Diagnostics', 'none', 'Lead level <1 mcg/dL. Normal range.'),
        (${emmaId}, 'Eczema Flare-Up', 'Dry, itchy patches on arms and behind knees', 'skin', '2025-10-05', 'Dr. Rebecca Chen', 'mild', 'Hydrocortisone cream and daily moisturizing. Improved in 1 week.'),
        (${emmaId}, 'Croup Episode', 'Barking cough at night with mild stridor', 'illness', '2025-12-18', 'Urgent Care - Dr. Tom Harris', 'moderate', 'Steam shower and cool night air helped. Single dose of oral steroid given.'),
        (${liamId}, 'Newborn Checkup', 'First pediatric visit at 3 days old. Healthy newborn.', 'checkup', '2025-01-13', 'Dr. Rebecca Chen', 'none', 'Weight 7lb 4oz, dropped 5% from birth weight. Normal. Jaundice mild.'),
        (${liamId}, '2-Month Well-Child Visit', 'Routine 2-month checkup. Growing well.', 'checkup', '2025-03-10', 'Dr. Rebecca Chen', 'none', 'Weight 12lb 2oz, length 23 inches. Smiling, good head control.'),
        (${liamId}, 'Mild Cradle Cap', 'Yellowish scaly patches on scalp', 'skin', '2025-02-15', 'Dr. Rebecca Chen', 'mild', 'Gentle brushing with soft brush and baby oil recommended.'),
        (${liamId}, 'Diaper Rash', 'Red, irritated skin in diaper area', 'skin', '2025-04-20', 'Dr. Rebecca Chen', 'mild', 'Zinc oxide cream applied at every change. Cleared in 4 days.')
    `);
    console.log('Inserted 19 health records');

    // ─── SLEEP RECORDS ───
    await client.query(`
      INSERT INTO sleep_records (child_id, date, sleep_start, sleep_end, quality, notes) VALUES
        (${emmaId}, '2026-03-17', '2026-03-17 19:30:00', '2026-03-18 06:45:00', 'Excellent', 'Excellent night sleep. Fell asleep quickly after bedtime routine.'),
        (${emmaId}, '2026-03-17', '2026-03-17 12:30:00', '2026-03-17 14:00:00', 'Good', 'Good afternoon nap. Woke up happy.'),
        (${emmaId}, '2026-03-16', '2026-03-16 19:45:00', '2026-03-17 06:30:00', 'Good', 'Slept through the night with one brief wake-up at 2am.'),
        (${emmaId}, '2026-03-16', '2026-03-16 13:00:00', '2026-03-16 14:30:00', 'Excellent', 'Long peaceful nap after park visit.'),
        (${emmaId}, '2026-03-15', '2026-03-15 20:00:00', '2026-03-16 06:00:00', 'Fair', 'Restless night. Woke up twice. May be teething molars.'),
        (${emmaId}, '2026-03-15', '2026-03-15 12:45:00', '2026-03-15 13:30:00', 'Poor', 'Short nap. Refused to settle initially.'),
        (${emmaId}, '2026-03-14', '2026-03-14 19:30:00', '2026-03-15 07:00:00', 'Excellent', 'Perfect night. 11.5 hours of uninterrupted sleep.'),
        (${emmaId}, '2026-03-14', '2026-03-14 13:00:00', '2026-03-14 14:45:00', 'Good', 'Good nap. Fell asleep listening to lullaby playlist.'),
        (${emmaId}, '2026-03-13', '2026-03-13 19:15:00', '2026-03-14 05:30:00', 'Fair', 'Woke early. May have had a bad dream.'),
        (${emmaId}, '2026-03-12', '2026-03-12 20:00:00', '2026-03-13 06:30:00', 'Good', 'Solid night. Read 3 books before bed.'),
        (${liamId}, '2026-03-17', '2026-03-17 19:00:00', '2026-03-17 23:30:00', 'Fair', 'First stretch of night sleep. Woke for feeding.'),
        (${liamId}, '2026-03-17', '2026-03-18 00:00:00', '2026-03-18 03:30:00', 'Fair', 'Second stretch. Fed and went back to sleep quickly.'),
        (${liamId}, '2026-03-17', '2026-03-18 04:00:00', '2026-03-18 07:00:00', 'Good', 'Final morning stretch. Woke up happy and babbling.'),
        (${liamId}, '2026-03-17', '2026-03-17 09:30:00', '2026-03-17 10:30:00', 'Good', 'Morning nap. Slept in stroller during walk.'),
        (${liamId}, '2026-03-17', '2026-03-17 13:00:00', '2026-03-17 15:00:00', 'Excellent', 'Long afternoon nap in crib. Great sleep.'),
        (${liamId}, '2026-03-16', '2026-03-16 19:00:00', '2026-03-17 00:00:00', 'Good', 'Good first stretch.'),
        (${liamId}, '2026-03-16', '2026-03-16 09:00:00', '2026-03-16 10:00:00', 'Fair', 'Short morning nap. Woke when doorbell rang.'),
        (${liamId}, '2026-03-16', '2026-03-16 13:30:00', '2026-03-16 15:30:00', 'Excellent', 'Excellent 2-hour afternoon nap.'),
        (${liamId}, '2026-03-15', '2026-03-15 18:45:00', '2026-03-15 23:00:00', 'Poor', 'Fussy evening. Took a long time to settle. Possible growth spurt.')
    `);
    console.log('Inserted 19 sleep records');

    // ─── FEEDING RECORDS ───
    await client.query(`
      INSERT INTO feeding_records (child_id, meal_type, food_items, quantity, meal_time, calories, notes) VALUES
        (${emmaId}, 'Breakfast', 'Oatmeal with banana slices and blueberries', '1 bowl', '2026-03-18 07:30:00', 220, 'Ate most of it. Loved the blueberries.'),
        (${emmaId}, 'Snack', 'Apple slices with sunflower butter', '1 serving', '2026-03-18 10:00:00', 150, 'Using sunflower butter due to peanut allergy.'),
        (${emmaId}, 'Lunch', 'Grilled chicken strips, rice, and steamed broccoli', '1 plate', '2026-03-18 12:00:00', 320, 'Ate all the chicken. Needed encouragement for broccoli.'),
        (${emmaId}, 'Snack', 'Greek yogurt with honey', '1 cup', '2026-03-18 15:00:00', 130, 'Favorite afternoon snack.'),
        (${emmaId}, 'Dinner', 'Pasta with tomato sauce and ground turkey', '1 bowl', '2026-03-17 17:30:00', 350, 'Loved the pasta. Asked for seconds.'),
        (${emmaId}, 'Breakfast', 'Scrambled eggs with toast and strawberries', '1 plate', '2026-03-17 07:45:00', 250, 'Good appetite this morning.'),
        (${emmaId}, 'Lunch', 'Turkey and cheese sandwich, carrot sticks, milk', '1 serving', '2026-03-17 12:00:00', 300, 'Ate half the sandwich and all the carrots.'),
        (${emmaId}, 'Dinner', 'Baked salmon, mashed sweet potato, green beans', '1 plate', '2026-03-16 17:30:00', 340, 'Surprisingly loved the salmon. Big win!'),
        (${emmaId}, 'Snack', 'Cheese cubes and whole grain crackers', '1 serving', '2026-03-16 10:00:00', 160, 'Quick snack before playground.'),
        (${emmaId}, 'Breakfast', 'Whole wheat pancakes with maple syrup and banana', '2 small pancakes', '2026-03-16 08:00:00', 280, 'Weekend pancake tradition.'),
        (${emmaId}, 'Lunch', 'Veggie quesadilla with guacamole', '1 quesadilla', '2026-03-15 12:30:00', 290, 'Loves guacamole. Tried to eat it with hands.'),
        (${emmaId}, 'Snack', 'Banana and milk', '1 banana, 1 cup milk', '2026-03-15 15:30:00', 200, 'Quick post-nap snack.'),
        (${emmaId}, 'Dinner', 'Chicken noodle soup with bread', '1 bowl', '2026-03-15 17:30:00', 260, 'Homemade soup. Perfect for the cool evening.'),
        (${liamId}, 'Breast milk', 'Breast milk - morning feed', '5 oz', '2026-03-18 07:00:00', 100, 'Good latch. Fed for 15 minutes.'),
        (${liamId}, 'Breast milk', 'Breast milk - mid-morning', '4 oz', '2026-03-18 10:00:00', 80, 'Shorter feed. Distracted by sister playing.'),
        (${liamId}, 'Solids', 'Sweet potato puree', '2 tbsp', '2026-03-18 12:00:00', 30, 'Just started solids. Seemed interested but spit most out.'),
        (${liamId}, 'Breast milk', 'Breast milk - afternoon', '5 oz', '2026-03-18 14:00:00', 100, 'Fell asleep while feeding.'),
        (${liamId}, 'Breast milk', 'Breast milk - evening', '6 oz', '2026-03-17 18:30:00', 120, 'Big feed before bedtime.'),
        (${liamId}, 'Formula', 'Supplemental formula bottle', '4 oz', '2026-03-17 22:00:00', 80, 'Dad gave bottle for night feed.'),
        (${liamId}, 'Solids', 'Rice cereal mixed with breast milk', '1 tbsp', '2026-03-17 12:00:00', 20, 'First try with rice cereal. Messy but fun!')
    `);
    console.log('Inserted 20 feeding records');

    // ─── GROWTH RECORDS ───
    await client.query(`
      INSERT INTO growth_records (child_id, measured_date, height_cm, weight_kg, head_circumference_cm, notes) VALUES
        (${emmaId}, '2023-03-15', 49.5, 3.40, 34.0, 'Birth measurements. Healthy full-term baby.'),
        (${emmaId}, '2023-04-15', 54.0, 4.20, 36.5, '1-month checkup. Good weight gain.'),
        (${emmaId}, '2023-05-15', 57.5, 5.10, 38.0, '2-month visit. Growing well. 50th percentile.'),
        (${emmaId}, '2023-07-15', 63.0, 6.50, 40.5, '4-month checkup. Excellent growth.'),
        (${emmaId}, '2023-09-15', 67.0, 7.60, 42.5, '6-month checkup. 60th percentile for height.'),
        (${emmaId}, '2023-12-15', 72.0, 8.80, 44.5, '9-month checkup. Strong and healthy.'),
        (${emmaId}, '2024-03-15', 76.0, 9.80, 46.0, '12-month checkup. Walking soon!'),
        (${emmaId}, '2024-09-15', 82.0, 11.20, 47.5, '18-month checkup. Very active toddler.'),
        (${emmaId}, '2025-03-15', 87.5, 12.50, 48.5, '24-month checkup. Tall for her age.'),
        (${emmaId}, '2025-09-15', 93.0, 13.80, 49.0, '30-month checkup. Growing steadily.'),
        (${emmaId}, '2026-03-15', 97.0, 14.80, 49.5, '36-month checkup. Healthy 3-year-old. 65th percentile.'),
        (${liamId}, '2025-01-10', 51.0, 3.60, 35.0, 'Birth measurements. Healthy boy, 7lb 14oz.'),
        (${liamId}, '2025-02-10', 55.5, 4.50, 37.0, '1-month checkup. Great weight gain.'),
        (${liamId}, '2025-03-10', 59.0, 5.40, 38.5, '2-month checkup. 55th percentile.'),
        (${liamId}, '2025-05-10', 64.5, 7.00, 41.0, '4-month checkup. Chunky and happy.'),
        (${liamId}, '2025-07-10', 68.0, 8.10, 43.0, '6-month checkup. Sitting up well.'),
        (${liamId}, '2025-10-10', 73.0, 9.30, 45.0, '9-month checkup. Crawling everywhere.'),
        (${liamId}, '2026-01-10', 77.0, 10.20, 46.5, '12-month checkup. First birthday! 60th percentile.'),
        (${liamId}, '2026-03-10', 79.5, 10.80, 47.0, '14-month measurement at checkup.')
    `);
    console.log('Inserted 19 growth records');

    // ─── VACCINATIONS ───
    await client.query(`
      INSERT INTO vaccinations (child_id, vaccine_name, dose_number, administered_date, next_due_date, provider, notes) VALUES
        (${emmaId}, 'Hepatitis B', 1, '2023-03-15', '2023-04-15', 'Hospital Nursery', 'Given at birth. No adverse reaction.'),
        (${emmaId}, 'Hepatitis B', 2, '2023-04-15', '2023-09-15', 'Dr. Rebecca Chen', 'Second dose at 1 month. Slight fussiness.'),
        (${emmaId}, 'Hepatitis B', 3, '2023-09-15', NULL, 'Dr. Rebecca Chen', 'Third and final dose. Series complete.'),
        (${emmaId}, 'DTaP', 1, '2023-05-15', '2023-07-15', 'Dr. Rebecca Chen', 'First dose at 2 months. Mild fever for 24 hours.'),
        (${emmaId}, 'DTaP', 2, '2023-07-15', '2023-09-15', 'Dr. Rebecca Chen', 'Second dose at 4 months. No reaction.'),
        (${emmaId}, 'DTaP', 3, '2023-09-15', '2024-06-15', 'Dr. Rebecca Chen', 'Third dose at 6 months.'),
        (${emmaId}, 'DTaP', 4, '2024-06-15', '2027-03-15', 'Dr. Rebecca Chen', 'Fourth dose at 15 months. Sore at injection site.'),
        (${emmaId}, 'IPV (Polio)', 1, '2023-05-15', '2023-07-15', 'Dr. Rebecca Chen', 'First dose given with DTaP.'),
        (${emmaId}, 'IPV (Polio)', 2, '2023-07-15', '2023-09-15', 'Dr. Rebecca Chen', 'Second dose.'),
        (${emmaId}, 'IPV (Polio)', 3, '2023-09-15', '2027-03-15', 'Dr. Rebecca Chen', 'Third dose at 6 months.'),
        (${emmaId}, 'MMR', 1, '2024-03-15', '2027-03-15', 'Dr. Rebecca Chen', 'First dose at 12 months. Mild rash 7 days later.'),
        (${emmaId}, 'Hib', 1, '2023-05-15', '2023-07-15', 'Dr. Rebecca Chen', 'First dose at 2 months.'),
        (${emmaId}, 'Hib', 2, '2023-07-15', '2023-09-15', 'Dr. Rebecca Chen', 'Second dose.'),
        (${emmaId}, 'Hib', 3, '2024-03-15', NULL, 'Dr. Rebecca Chen', 'Booster dose at 12 months. Series complete.'),
        (${emmaId}, 'PCV13', 1, '2023-05-15', '2023-07-15', 'Dr. Rebecca Chen', 'First pneumococcal dose at 2 months.'),
        (${emmaId}, 'PCV13', 2, '2023-07-15', '2023-09-15', 'Dr. Rebecca Chen', 'Second dose at 4 months.'),
        (${emmaId}, 'PCV13', 3, '2023-09-15', '2024-03-15', 'Dr. Rebecca Chen', 'Third dose at 6 months.'),
        (${emmaId}, 'PCV13', 4, '2024-03-15', NULL, 'Dr. Rebecca Chen', 'Fourth dose booster. Series complete.'),
        (${emmaId}, 'Rotavirus', 1, '2023-05-15', '2023-07-15', 'Dr. Rebecca Chen', 'Oral vaccine at 2 months.'),
        (${emmaId}, 'Rotavirus', 2, '2023-07-15', NULL, 'Dr. Rebecca Chen', 'Second dose at 4 months. Series complete.'),
        (${emmaId}, 'Varicella', 1, '2024-03-15', '2027-03-15', 'Dr. Rebecca Chen', 'Chickenpox vaccine at 12 months.'),
        (${emmaId}, 'Influenza', 1, '2025-10-01', '2026-10-01', 'Dr. Rebecca Chen', 'Annual flu shot. No reaction.'),
        (${liamId}, 'Hepatitis B', 1, '2025-01-10', '2025-02-10', 'Hospital Nursery', 'Given at birth.'),
        (${liamId}, 'Hepatitis B', 2, '2025-02-10', '2025-07-10', 'Dr. Rebecca Chen', 'Second dose at 1 month.'),
        (${liamId}, 'DTaP', 1, '2025-03-10', '2025-05-10', 'Dr. Rebecca Chen', 'First dose at 2 months. Mild fever overnight.'),
        (${liamId}, 'DTaP', 2, '2025-05-10', '2025-07-10', 'Dr. Rebecca Chen', 'Second dose at 4 months.')
    `);
    console.log('Inserted 26 vaccinations');

    // ─── BEHAVIORAL NOTES ───
    await client.query(`
      INSERT INTO behavioral_notes (child_id, title, behavior, context, observed_date, mood, severity) VALUES
        (${emmaId}, 'Sharing Toys Voluntarily', 'Offered her favorite doll to a younger child at the park without being asked', 'Playground with other children', '2026-03-15', 'happy', 'positive'),
        (${emmaId}, 'Bedtime Tantrum', 'Screamed and cried for 20 minutes when told it was bedtime. Threw stuffed animal.', 'Bedtime routine after exciting day', '2026-03-14', 'angry', 'moderate'),
        (${emmaId}, 'Separation Anxiety at Daycare', 'Clung to mom and cried at daycare drop-off for 10 minutes', 'Monday morning daycare drop-off', '2026-03-11', 'anxious', 'mild'),
        (${emmaId}, 'Curiosity About Animals', 'Spent 30 minutes watching ants on the sidewalk, asking questions about where they live', 'Nature walk', '2026-03-16', 'curious', 'positive'),
        (${emmaId}, 'Fear of Loud Sounds', 'Covered ears and ran to mom when a truck honked loudly nearby', 'Walking on sidewalk near road', '2026-03-10', 'scared', 'mild'),
        (${emmaId}, 'Making Friends at Park', 'Approached new children and asked them to play, shared her bucket and shovel', 'Sandbox at Lincoln Park', '2026-03-09', 'happy', 'positive'),
        (${emmaId}, 'Showing Empathy', 'Hugged her brother when he was crying and said "its okay baby"', 'Home, after Liam bumped his head', '2026-03-13', 'caring', 'positive'),
        (${emmaId}, 'Food Refusal', 'Refused to eat any vegetables at dinner, crossed arms and said "no green things"', 'Dinner time', '2026-03-12', 'stubborn', 'mild'),
        (${emmaId}, 'Imaginative Play', 'Set up a pretend restaurant and served "meals" to all her stuffed animals', 'Playroom, independent play', '2026-03-08', 'happy', 'positive'),
        (${emmaId}, 'Helping with Chores', 'Insisted on helping load the dishwasher and sorting laundry by color', 'Kitchen and laundry room', '2026-03-07', 'proud', 'positive'),
        (${emmaId}, 'Jealousy Toward Brother', 'Pushed Liam away when mom was holding him and said "my mommy"', 'Living room during feeding time', '2026-03-06', 'jealous', 'moderate'),
        (${emmaId}, 'Night Terrors', 'Woke up screaming and disoriented. Did not recognize parents for 2 minutes.', 'Midnight, bedroom', '2026-03-05', 'scared', 'moderate'),
        (${emmaId}, 'Counting Everything', 'Spontaneously counted stairs as we walked up them (got to 12 correctly)', 'Going upstairs for bath', '2026-03-04', 'excited', 'positive'),
        (${emmaId}, 'Refusing to Wear Coat', 'Full meltdown about putting on winter coat. Arching back and screaming.', 'Getting ready to leave house', '2026-03-03', 'angry', 'moderate'),
        (${emmaId}, 'Being Gentle with Pets', 'Gently petted the neighbor cat and whispered "nice kitty, soft"', 'Front yard with neighbor', '2026-03-02', 'gentle', 'positive'),
        (${liamId}, 'Social Smiling', 'Smiles broadly whenever he sees familiar faces, especially sister', 'Throughout the day', '2026-03-15', 'happy', 'positive'),
        (${liamId}, 'Stranger Anxiety Beginning', 'Cried when unfamiliar relative tried to hold him', 'Family gathering', '2026-03-10', 'anxious', 'mild'),
        (${liamId}, 'Excited by Music', 'Bounces and waves arms whenever music plays, tries to grab musical toys', 'Living room during music time', '2026-03-12', 'excited', 'positive')
    `);
    console.log('Inserted 18 behavioral notes');

    // ─── JOURNAL ENTRIES ───
    await client.query(`
      INSERT INTO journal_entries (child_id, title, content, mood, entry_date, tags) VALUES
        (${emmaId}, 'First Day at New Daycare', 'Today was Emma''s first day at Sunshine Daycare. She was nervous at drop-off and held onto my leg, but the teacher said she warmed up within 20 minutes and was playing happily with other kids by snack time. She came home talking about her new friend Sofia. So proud of my brave girl!', 'hopeful', '2026-01-06', 'daycare,milestones,social'),
        (${emmaId}, 'Family Trip to the Zoo', 'We took both kids to the zoo today. Emma was absolutely mesmerized by the giraffes and kept asking why their necks are so long. She roared at the lions and they actually roared back, which both thrilled and terrified her. Liam slept through most of it in the carrier. Such a fun family day!', 'joyful', '2026-02-15', 'family,outing,animals'),
        (${emmaId}, 'The Things She Says', 'Emma''s vocabulary is exploding. Today she said "Mommy, the sun is sleeping" when it went behind a cloud. She also told the dog to "be more careful" when he knocked over her block tower. I need to start writing these down more often because they are pure gold.', 'amused', '2026-03-10', 'language,funny,development'),
        (${emmaId}, 'Learning to Share', 'Had a playdate today and there were some tough moments with sharing. Emma grabbed a toy from her friend and I had to intervene. We practiced taking turns and by the end, she was offering toys to her friend on her own. Baby steps in the right direction.', 'reflective', '2026-03-01', 'social,learning,playdate'),
        (${emmaId}, 'Easter Egg Hunt', 'Emma participated in her first real Easter egg hunt at the community center. She was so focused and determined, carefully looking under every bush. She found 8 eggs and was thrilled with each one. Her face when she opened them and found chocolate inside was priceless.', 'joyful', '2025-04-20', 'holiday,celebration,community'),
        (${emmaId}, 'Sick Day Cuddles', 'Emma has a cold and just wanted to curl up on the couch and watch movies all day. As miserable as she felt, there was something sweet about having her snuggled up against me all day. We watched Frozen for the hundredth time and she sang along even with her stuffy nose.', 'tender', '2026-01-15', 'sick,cuddles,movies'),
        (${emmaId}, 'Painting Masterpiece', 'Emma painted a picture of our family today. Mom has purple hair, dad is "really really tall," Liam is a tiny circle, and the dog is bigger than all of us. She was so proud and insisted we hang it on the fridge. It''s the best artwork I''ve ever seen.', 'proud', '2026-03-05', 'art,creative,family'),
        (${emmaId}, 'The Potty Training Victory', 'After weeks of trying, Emma used the potty completely on her own today without any reminders! She ran out of the bathroom shouting "I did it! I did it!" We did a happy dance together. Small victories feel monumental in parenthood.', 'triumphant', '2025-11-20', 'milestone,potty-training,victory'),
        (${emmaId}, 'Her First Best Friend', 'Emma has been talking nonstop about Sofia from daycare. They apparently hold hands during circle time and save seats for each other at lunch. Today she asked if Sofia could come to her birthday party. Watching her form her first real friendship is so heartwarming.', 'warm', '2026-02-28', 'friendship,social,daycare'),
        (${emmaId}, 'Challenging Morning', 'Everything was a battle this morning. She didn''t want to get dressed, didn''t want breakfast, didn''t want to go to daycare. I felt my patience wearing thin but managed to stay calm. We eventually got through it with some compromise (she wore rain boots with her dress). Parenting is humbling.', 'exhausted', '2026-03-13', 'challenges,patience,morning-routine'),
        (${emmaId}, 'Christmas Morning Magic', 'Watching Emma come downstairs and see the Christmas tree with presents was everything. She gasped and her eyes went wide. She kept saying "Santa came! Santa really came!" The pure wonder and belief in magic at this age is something I want to remember forever.', 'magical', '2025-12-25', 'holiday,christmas,magic'),
        (${emmaId}, 'Dance Recital Debut', 'Emma had her first mini dance recital at her Saturday class today. She mostly stood there looking at the audience for the first minute, then suddenly started dancing with wild abandon. Not exactly the choreography but 100% pure Emma. We cheered the loudest.', 'proud', '2026-02-22', 'dance,performance,milestone'),
        (${emmaId}, 'Reading Her First Word', 'Emma pointed at a stop sign today and said "S-T-O-P, that says STOP!" I nearly cried. We''ve been practicing letters and sounds, and seeing it click was incredible. She then tried to "read" every sign we passed. Mostly wrong but the enthusiasm is everything.', 'excited', '2026-03-08', 'reading,milestone,education'),
        (${liamId}, 'Liam''s First Laugh', 'Liam laughed for the first time today! Emma was making silly faces at him and he just burst out giggling. It was the most beautiful sound. Emma was so proud that she was the one who made him laugh. These sibling moments are what I live for.', 'overjoyed', '2025-05-15', 'milestone,sibling,laughter'),
        (${liamId}, 'Rolling Over Champion', 'Liam rolled from tummy to back today during tummy time. He looked as surprised as we were! Emma immediately started cheering and clapping for him. He did it 3 more times as if showing off for his audience.', 'proud', '2025-04-20', 'milestone,motor-skills,development'),
        (${liamId}, 'Starting Solid Foods', 'Today was Liam''s first taste of real food - sweet potato puree. His expression went from confused to disgusted to intrigued to wanting more. Most of it ended up on his face and bib, but he definitely swallowed some. A new adventure begins!', 'excited', '2026-03-15', 'feeding,milestone,solids'),
        (${liamId}, 'Sibling Bond Growing', 'Caught Emma reading a book to Liam today. She was holding it up and pointing at the pictures, explaining everything in her own words. Liam was staring at her completely captivated. My heart cannot handle how much they already love each other.', 'grateful', '2026-03-12', 'siblings,bonding,reading')
    `);
    console.log('Inserted 17 journal entries');

    // ─── MEDICATIONS ───
    await client.query(`
      INSERT INTO medications (child_id, name, dosage, frequency, start_date, end_date, prescribed_by, notes) VALUES
        (${emmaId}, 'Children''s Tylenol (Acetaminophen)', '5ml (160mg)', 'Every 4-6 hours as needed', '2026-03-14', '2026-03-16', 'Dr. Rebecca Chen', 'For fever and pain. Do not exceed 5 doses in 24 hours.'),
        (${emmaId}, 'Amoxicillin', '5ml twice daily', 'Twice daily', '2024-06-20', '2024-06-30', 'Dr. Rebecca Chen', 'For ear infection. Complete full 10-day course even if symptoms improve.'),
        (${emmaId}, 'Vitamin D Drops', '400 IU (1 drop)', 'Once daily', '2023-03-15', NULL, 'Dr. Rebecca Chen', 'Daily vitamin D supplement. One drop in milk or on food.'),
        (${emmaId}, 'Children''s Benadryl (Diphenhydramine)', '5ml', 'As needed for allergic reaction', '2024-11-12', '2024-11-14', 'Dr. Rebecca Chen', 'For peanut allergy reaction. Carry EpiPen as backup.'),
        (${emmaId}, 'Hydrocortisone Cream 1%', 'Thin layer', 'Twice daily to affected areas', '2025-10-05', '2025-10-19', 'Dr. Rebecca Chen', 'For eczema flare-up on arms and behind knees. Apply after moisturizer.'),
        (${emmaId}, 'Children''s Zyrtec (Cetirizine)', '2.5ml', 'Once daily', '2025-04-01', '2025-06-30', 'Dr. Rebecca Chen', 'For seasonal allergies. Give in the evening.'),
        (${emmaId}, 'Probiotic Drops (Culturelle Kids)', '1ml', 'Once daily', '2025-04-22', '2025-05-22', 'Dr. Rebecca Chen', 'After stomach bug to restore gut flora. Mix with food or drink.'),
        (${emmaId}, 'Iron Supplement (NovaFerrum)', '1ml', 'Once daily', '2024-06-15', '2024-09-15', 'Dr. Rebecca Chen', 'Mild iron deficiency found at 15-month checkup. Recheck levels in 3 months.'),
        (${emmaId}, 'Children''s Motrin (Ibuprofen)', '5ml (100mg)', 'Every 6-8 hours as needed', '2025-12-18', '2025-12-20', 'Urgent Care - Dr. Tom Harris', 'For croup-related discomfort. Alternate with Tylenol if needed.'),
        (${emmaId}, 'Oral Prednisolone', '1ml (5mg)', 'Single dose', '2025-12-18', '2025-12-18', 'Urgent Care - Dr. Tom Harris', 'Single dose oral steroid for croup. Given at urgent care.'),
        (${emmaId}, 'Aquaphor Healing Ointment', 'Liberal application', 'After every bath and as needed', '2025-09-01', NULL, 'Dr. Rebecca Chen', 'Daily moisturizer for eczema-prone skin. Apply within 3 minutes of bath.'),
        (${emmaId}, 'Fluoride Toothpaste', 'Pea-sized amount', 'Twice daily', '2025-03-15', NULL, 'Dr. James Park, DDS', 'Switched from training toothpaste to fluoride at dentist recommendation.'),
        (${emmaId}, 'Children''s Flonase', '1 spray each nostril', 'Once daily', '2026-03-01', '2026-04-30', 'Dr. Rebecca Chen', 'For spring allergy season. Start 2 weeks before peak season.'),
        (${liamId}, 'Vitamin D Drops', '400 IU (1 drop)', 'Once daily', '2025-01-14', NULL, 'Dr. Rebecca Chen', 'Essential supplement for breastfed babies. One drop daily.'),
        (${liamId}, 'Infant Tylenol (Acetaminophen)', '1.25ml (80mg)', 'Every 4-6 hours as needed', '2025-03-10', '2025-03-11', 'Dr. Rebecca Chen', 'For post-vaccination fever and fussiness.'),
        (${liamId}, 'Simethicone Drops (Gas Relief)', '0.3ml', 'Up to 12 times daily as needed', '2025-02-01', '2025-04-01', 'Dr. Rebecca Chen', 'For gas and colic relief. Safe to use frequently.'),
        (${liamId}, 'Zinc Oxide Diaper Cream', 'Thick layer', 'Every diaper change', '2025-04-20', '2025-04-25', 'Dr. Rebecca Chen', 'For diaper rash treatment. Apply generously as barrier cream.'),
        (${liamId}, 'Probiotic Drops (BioGaia)', '5 drops', 'Once daily', '2025-02-15', NULL, 'Dr. Rebecca Chen', 'Infant probiotic for digestive health. Add to bottle or breast.')
    `);
    console.log('Inserted 18 medications');

    // ─── APPOINTMENTS ───
    await client.query(`
      INSERT INTO appointments (child_id, title, provider, location, appointment_date, appointment_type, status, notes) VALUES
        (${emmaId}, '3-Year Well-Child Checkup', 'Dr. Rebecca Chen', 'Pediatric Associates, 100 Medical Dr', '2026-03-20 09:00:00', 'checkup', 'scheduled', 'Annual physical. Bring vaccination records. Discuss preschool readiness.'),
        (${emmaId}, 'Dental Cleaning', 'Dr. James Park, DDS', 'Smile Pediatric Dentistry, 45 Oak St', '2026-04-10 10:00:00', 'dental', 'scheduled', 'Routine cleaning and checkup. Last visit was September.'),
        (${emmaId}, 'Eye Exam Follow-Up', 'Dr. Lisa Wong, OD', 'Clear Vision Optometry, 78 Main St', '2026-04-25 14:00:00', 'vision', 'scheduled', 'Annual vision follow-up.'),
        (${emmaId}, 'Allergy Specialist', 'Dr. Mark Stevens', 'Allergy & Asthma Center, 200 Health Ave', '2026-03-28 11:00:00', 'specialist', 'scheduled', 'Annual peanut allergy review. May do skin prick test update.'),
        (${emmaId}, 'Swimming Class', 'Coach Jenny', 'Community Pool, 150 Recreation Blvd', '2026-03-22 09:30:00', 'class', 'scheduled', 'Weekly Saturday swim class. Bring swim diaper and goggles.'),
        (${emmaId}, 'Music Class - Spring Session', 'Ms. Harmony', 'Harmony Music Studio, 33 Melody Lane', '2026-03-19 11:00:00', 'class', 'scheduled', 'Weekly Wednesday music class. Spring session through May.'),
        (${emmaId}, 'Dance Class', 'Miss Ballet', 'Tiny Dancers Studio, 90 Dance Way', '2026-03-21 10:00:00', 'class', 'scheduled', 'Saturday creative movement class. Wear pink leotard.'),
        (${emmaId}, 'Daycare Parent-Teacher Conference', 'Ms. Rodriguez', 'Sunshine Daycare, 55 Elm St', '2026-03-25 16:30:00', 'meeting', 'scheduled', 'Quarterly progress discussion. Ask about social development.'),
        (${emmaId}, 'Speech Evaluation', 'Dr. Amy Foster, SLP', 'Children''s Therapy Center, 120 Care St', '2026-04-05 13:00:00', 'evaluation', 'scheduled', 'Routine speech evaluation recommended at 3-year checkup. Probably fine but good to check.'),
        (${emmaId}, 'Preschool Tour - Bright Futures', 'Admissions Office', 'Bright Futures Preschool, 88 Learning Ln', '2026-04-01 09:30:00', 'tour', 'scheduled', 'Tour and interview for fall enrollment. Bring immunization records.'),
        (${liamId}, '15-Month Well-Child Visit', 'Dr. Rebecca Chen', 'Pediatric Associates, 100 Medical Dr', '2026-04-10 10:30:00', 'checkup', 'scheduled', 'Routine checkup. Vaccines due: Hib booster, PCV13 booster.'),
        (${liamId}, 'First Dental Visit', 'Dr. James Park, DDS', 'Smile Pediatric Dentistry, 45 Oak St', '2026-05-15 09:00:00', 'dental', 'scheduled', 'Recommended first dental visit. Now has 8 teeth.'),
        (${liamId}, 'Mommy & Me Swim Class', 'Coach Jenny', 'Community Pool, 150 Recreation Blvd', '2026-03-22 10:30:00', 'class', 'scheduled', 'Baby swim class. Focus on water comfort and safety.'),
        (${liamId}, 'Baby Music Class', 'Ms. Harmony', 'Harmony Music Studio, 33 Melody Lane', '2026-03-19 10:00:00', 'class', 'scheduled', 'Baby rhythm and music exploration class.'),
        (${liamId}, 'Flu Shot', 'Dr. Rebecca Chen', 'Pediatric Associates, 100 Medical Dr', '2026-10-01 09:00:00', 'vaccination', 'scheduled', 'Annual flu shot for upcoming season.'),
        (${emmaId}, 'Dermatology Follow-Up', 'Dr. Sarah Kim', 'Skin Care Specialists, 60 Derma Dr', '2026-04-15 15:00:00', 'specialist', 'scheduled', 'Follow-up for eczema management. Discuss long-term plan.')
    `);
    console.log('Inserted 16 appointments');

    // ─── EMERGENCY CONTACTS ───
    await client.query(`
      INSERT INTO emergency_contacts (user_id, name, relationship, phone, email, address, is_primary) VALUES
        (${userId}, 'Michael Johnson', 'Father / Spouse', '(555) 123-4567', 'michael.johnson@email.com', '42 Maple Street, Springfield, IL 62701', true),
        (${userId}, 'Sarah Johnson', 'Mother (Self)', '(555) 234-5678', 'demo@childcare.com', '42 Maple Street, Springfield, IL 62701', true),
        (${userId}, 'Margaret Johnson', 'Paternal Grandmother', '(555) 345-6789', 'margaret.j@email.com', '108 Oak Avenue, Springfield, IL 62702', false),
        (${userId}, 'Robert Johnson', 'Paternal Grandfather', '(555) 345-6780', 'robert.j@email.com', '108 Oak Avenue, Springfield, IL 62702', false),
        (${userId}, 'Linda Martinez', 'Maternal Grandmother', '(555) 456-7890', 'linda.martinez@email.com', '225 Pine Road, Decatur, IL 62521', false),
        (${userId}, 'Carlos Martinez', 'Maternal Grandfather', '(555) 456-7891', 'carlos.m@email.com', '225 Pine Road, Decatur, IL 62521', false),
        (${userId}, 'Jessica Thompson', 'Aunt (Maternal)', '(555) 567-8901', 'jessica.thompson@email.com', '15 Birch Lane, Springfield, IL 62703', false),
        (${userId}, 'David Johnson', 'Uncle (Paternal)', '(555) 678-9012', 'david.johnson@email.com', '330 Cedar Court, Champaign, IL 61820', false),
        (${userId}, 'Rachel Green', 'Neighbor / Emergency Backup', '(555) 789-0123', 'rachel.green@email.com', '44 Maple Street, Springfield, IL 62701', false),
        (${userId}, 'Dr. Rebecca Chen', 'Pediatrician', '(555) 890-1234', 'office@pediatricassociates.com', 'Pediatric Associates, 100 Medical Dr, Springfield, IL 62704', false),
        (${userId}, 'Sunshine Daycare', 'Daycare Center', '(555) 901-2345', 'info@sunshinedaycare.com', '55 Elm Street, Springfield, IL 62701', false),
        (${userId}, 'Emily Watson', 'Regular Babysitter', '(555) 012-3456', 'emily.watson@email.com', '72 Willow Way, Springfield, IL 62703', false),
        (${userId}, 'Karen Chen', 'Family Friend / Nurse', '(555) 111-2222', 'karen.chen@email.com', '90 Health Street, Springfield, IL 62704', false),
        (${userId}, 'Springfield Memorial Hospital', 'Nearest Hospital', '(555) 333-4444', 'er@springfieldmemorial.org', '500 Hospital Blvd, Springfield, IL 62704', false),
        (${userId}, 'Poison Control Center', 'Emergency Service', '(800) 222-1222', NULL, 'National Hotline', false),
        (${userId}, 'Mark Thompson', 'Uncle (by marriage)', '(555) 567-8902', 'mark.thompson@email.com', '15 Birch Lane, Springfield, IL 62703', false)
    `);
    console.log('Inserted 16 emergency contacts');

    // ─── LEARNING RESOURCES ───
    await client.query(`
      INSERT INTO learning_resources (child_id, title, description, resource_type, url, age_range_start, age_range_end, category) VALUES
        (${emmaId}, 'Khan Academy Kids', 'Free educational app with thousands of activities covering reading, math, and social-emotional development', 'app', 'https://learn.khanacademy.org/khan-academy-kids/', 2, 7, 'Education'),
        (${emmaId}, 'ABCmouse', 'Comprehensive early learning academy with step-by-step curriculum for ages 2-8', 'app', 'https://www.abcmouse.com', 2, 8, 'Education'),
        (${emmaId}, 'Sesame Street Videos', 'Educational videos featuring Elmo, Big Bird, and friends teaching letters, numbers, and social skills', 'video', 'https://www.sesamestreet.org', 2, 5, 'Education'),
        (${emmaId}, 'Pete the Cat Book Series', 'Beloved children''s book series about a cool cat who teaches positive thinking and resilience', 'book', 'https://www.petethecat.com', 2, 6, 'Reading'),
        (${emmaId}, 'Baby Einstein - Numbers Nursery', 'Engaging video introducing numbers 1-5 with puppets and music', 'video', 'https://www.youtube.com/babyeinstein', 1, 3, 'Math'),
        (${emmaId}, 'Daniel Tiger''s Neighborhood', 'PBS show teaching social-emotional skills through music and storytelling', 'video', 'https://pbskids.org/daniel', 2, 5, 'Social-Emotional'),
        (${emmaId}, 'The Very Hungry Caterpillar - Interactive Book', 'Digital version of the classic Eric Carle book with interactive elements', 'app', 'https://apps.apple.com/app/very-hungry-caterpillar', 1, 4, 'Reading'),
        (${emmaId}, 'Cosmic Kids Yoga', 'YouTube channel with yoga adventures designed for kids aged 3+', 'video', 'https://www.youtube.com/cosmickidsyoga', 3, 8, 'Physical'),
        (${emmaId}, 'Numberblocks (BBC)', 'Animated series that makes learning numbers fun and visual', 'video', 'https://www.bbc.co.uk/cbeebies/shows/numberblocks', 2, 6, 'Math'),
        (${emmaId}, 'Lovevery Play Kits', 'Stage-based play kits with Montessori-inspired toys and activity guides', 'subscription', 'https://lovevery.com', 0, 4, 'Development'),
        (${emmaId}, 'Highlights Magazine for Kids', 'Monthly magazine with puzzles, stories, and activities', 'magazine', 'https://www.highlights.com', 2, 6, 'Education'),
        (${emmaId}, 'Goodnight Moon - Classic Bedtime Book', 'The classic bedtime story for establishing reading routines', 'book', 'https://www.harpercollins.com/products/goodnight-moon', 0, 4, 'Reading'),
        (${emmaId}, 'Super Simple Songs', 'YouTube channel with catchy educational songs for toddlers and preschoolers', 'video', 'https://www.youtube.com/supersimplesongs', 1, 5, 'Music'),
        (${emmaId}, 'Montessori Practical Life Activities', 'Blog with age-appropriate Montessori activities to do at home', 'website', 'https://www.montessoriinreallife.com', 1, 6, 'Life Skills'),
        (${emmaId}, 'CDC Milestone Tracker App', 'Free app from CDC to track developmental milestones and get tips', 'app', 'https://www.cdc.gov/milestones', 0, 5, 'Development'),
        (${liamId}, 'Baby Einstein Discovery Cards', 'High-contrast cards for visual stimulation and early learning', 'toy', 'https://www.babyeinstein.com', 0, 1, 'Sensory'),
        (${liamId}, 'Infant Stimulation Cards', 'Black and white pattern cards for newborn visual development', 'toy', NULL, 0, 3, 'Sensory'),
        (${liamId}, 'Pathways.org Baby Activities', 'Expert-approved activities for baby development by month', 'website', 'https://pathways.org/baby-milestones', 0, 2, 'Development'),
        (${liamId}, 'Sandra Boynton Board Books', 'Fun, interactive board books perfect for babies and toddlers', 'book', NULL, 0, 3, 'Reading'),
        (${liamId}, 'Baby Shark Songs', 'Popular baby music for movement and engagement', 'video', 'https://www.youtube.com/pinkfong', 0, 3, 'Music')
    `);
    console.log('Inserted 20 learning resources');

    // ─── DIAPER RECORDS ───
    await client.query(`
      INSERT INTO diaper_records (child_id, change_time, type, notes) VALUES
        (${liamId}, '2026-03-18 06:30:00', 'wet', 'Morning diaper. Normal.'),
        (${liamId}, '2026-03-18 09:00:00', 'dirty', 'After morning feed. Normal consistency.'),
        (${liamId}, '2026-03-18 11:30:00', 'wet', 'Light wet diaper before lunch.'),
        (${liamId}, '2026-03-18 14:00:00', 'both', 'After afternoon nap. Used extra wipes.'),
        (${liamId}, '2026-03-18 17:00:00', 'wet', 'Changed before evening routine.'),
        (${liamId}, '2026-03-17 07:00:00', 'both', 'Big morning diaper. Applied barrier cream.'),
        (${liamId}, '2026-03-17 12:00:00', 'dirty', 'After trying rice cereal. Slightly different color due to solids.'),
        (${liamId}, '2026-03-17 19:00:00', 'wet', 'Last change before bedtime.')
    `);
    console.log('Inserted 8 diaper records');

    // ─── EXPENSES ───
    await client.query(`
      INSERT INTO expenses (user_id, child_id, title, amount, category, expense_date, payment_method, receipt_url, notes) VALUES
        (${userId}, ${emmaId}, 'Sunshine Daycare - March Tuition', 1200.00, 'Childcare', '2026-03-01', 'Bank Transfer', NULL, 'Monthly daycare tuition for Emma. Includes meals and snacks.'),
        (${userId}, ${liamId}, 'Infant Formula - Similac Pro-Advance', 38.99, 'Feeding', '2026-03-10', 'Credit Card', NULL, 'Supplemental formula for nighttime feeds.'),
        (${userId}, ${emmaId}, 'Spring Wardrobe - Target Kids', 85.50, 'Clothing', '2026-03-05', 'Credit Card', NULL, 'New spring clothes. She outgrew last year''s wardrobe.'),
        (${userId}, NULL, 'Diapers - Pampers Size 4 (150 ct)', 42.99, 'Supplies', '2026-03-08', 'Credit Card', NULL, 'Monthly diaper supply from Costco.'),
        (${userId}, ${emmaId}, 'Tiny Dancers Studio - Spring Session', 150.00, 'Activities', '2026-03-01', 'Credit Card', NULL, 'Creative movement dance class. 10-week spring session.')
    `);
    console.log('Inserted 5 expenses');

    // ─── CAREGIVER LOGS ───
    await client.query(`
      INSERT INTO caregiver_logs (user_id, child_id, caregiver_name, relationship, start_time, end_time, activities, notes, rating) VALUES
        (${userId}, ${emmaId}, 'Emily Watson', 'Babysitter', '2026-03-14 18:00:00', '2026-03-14 22:00:00', 'Dinner, bath time, bedtime stories, put to bed by 7:30pm', 'Emily is wonderful. Emma asked when she''s coming back.', 5),
        (${userId}, ${liamId}, 'Margaret Johnson', 'Grandmother', '2026-03-10 09:00:00', '2026-03-10 17:00:00', 'Feeding, tummy time, walks in the stroller, nap supervision', 'Grandma watched Liam while we took Emma to the zoo. All went smoothly.', 5),
        (${userId}, ${emmaId}, 'Jessica Thompson', 'Aunt', '2026-03-07 10:00:00', '2026-03-07 15:00:00', 'Trip to the children''s museum, lunch at the cafe, craft time', 'Aunt Jessica took Emma for a fun outing. Emma made a clay sculpture.', 4)
    `);
    console.log('Inserted 3 caregiver logs');

    // ─── DAILY ROUTINES ───
    await client.query(`
      INSERT INTO daily_routines (child_id, title, time_of_day, scheduled_time, duration_minutes, category, days_of_week, is_active, notes) VALUES
        (${emmaId}, 'Morning Wake-Up & Breakfast', 'morning', '07:00:00', 45, 'Meals', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', true, 'Wake up, get dressed, eat breakfast. Let her choose between 2 outfit options.'),
        (${emmaId}, 'Brush Teeth - Morning', 'morning', '07:45:00', 5, 'Hygiene', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', true, 'Use fluoride toothpaste, pea-sized amount. She likes the strawberry flavor.'),
        (${emmaId}, 'Afternoon Nap', 'afternoon', '12:30:00', 90, 'Sleep', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', true, 'Transitioning away from naps but still needs one most days. Read 2 books first.'),
        (${emmaId}, 'Outdoor Play Time', 'afternoon', '15:30:00', 60, 'Play', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', true, 'Backyard or park. Important for burning energy before dinner.'),
        (${emmaId}, 'Bath Time', 'evening', '18:30:00', 30, 'Hygiene', 'Mon,Wed,Fri,Sun', true, 'Bath every other day unless messy. Aquaphor moisturizer immediately after.'),
        (${emmaId}, 'Bedtime Routine', 'evening', '19:00:00', 30, 'Sleep', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', true, 'PJs, brush teeth, 3 books, 1 song, lights out by 7:30. Night light on.')
    `);
    console.log('Inserted 6 daily routines');

    // ─── TOOTH RECORDS ───
    await client.query(`
      INSERT INTO tooth_records (child_id, tooth_name, tooth_position, event_type, event_date, notes) VALUES
        (${emmaId}, 'Lower Central Incisor', 'bottom-front-left', 'erupted', '2023-09-15', 'First tooth! She was fussy for a few days before it appeared.'),
        (${emmaId}, 'Lower Central Incisor', 'bottom-front-right', 'erupted', '2023-10-01', 'Second tooth came in quickly after the first.'),
        (${emmaId}, 'Upper Central Incisor', 'top-front-left', 'erupted', '2023-11-20', 'Top teeth coming in. Lots of drooling.'),
        (${emmaId}, 'Upper Central Incisor', 'top-front-right', 'erupted', '2023-12-05', 'Now has 4 teeth. Big smiles!')
    `);
    console.log('Inserted 4 tooth records');

    // ─── PHOTO MEMORIES ───
    await client.query(`
      INSERT INTO photo_memories (child_id, title, description, memory_date, category, location, people_in_photo) VALUES
        (${emmaId}, 'First Day of Daycare', 'Emma standing at the daycare door with her little backpack, waving goodbye. Brave girl!', '2026-01-06', 'Milestone', 'Sunshine Daycare', 'Emma'),
        (${emmaId}, 'Zoo Adventure with Giraffes', 'Emma''s face lit up seeing the giraffes for the first time. Pure wonder.', '2026-02-15', 'Outing', 'Springfield Zoo', 'Emma, Sarah, Michael, Liam'),
        (${liamId}, 'Liam''s First Birthday Party', 'Smash cake photo. Frosting everywhere, biggest smile on his face.', '2026-01-10', 'Birthday', 'Home - Backyard', 'Liam, Emma, Sarah, Michael, Grandparents'),
        (${emmaId}, 'Siblings Reading Together', 'Emma reading Goodnight Moon to Liam on the couch. He was mesmerized.', '2026-03-12', 'Family', 'Living Room', 'Emma, Liam'),
        (${emmaId}, 'Dance Recital Debut', 'Emma in her pink tutu on stage. Not quite following the choreography but giving it her all.', '2026-02-22', 'Performance', 'Tiny Dancers Studio', 'Emma')
    `);
    console.log('Inserted 5 photo memories');

    // ─── CHORES ───
    await client.query(`
      INSERT INTO chores (child_id, title, description, frequency, assigned_date, due_date, status, reward, notes) VALUES
        (${emmaId}, 'Put Toys Away', 'Put all toys back in the toy bin before dinner', 'daily', '2026-03-15', '2026-03-18', 'completed', 'Sticker on reward chart', 'She''s getting better at this. Only needed one reminder today.'),
        (${emmaId}, 'Help Set the Table', 'Place napkins and plastic cups on the table for dinner', 'daily', '2026-03-15', '2026-03-18', 'completed', 'Sticker on reward chart', 'Loves feeling like a helper. Counts the cups out loud.'),
        (${emmaId}, 'Water the Plants', 'Use small watering can to water the potted plants on the porch', 'weekly', '2026-03-16', '2026-03-22', 'pending', 'Extra story at bedtime', 'She tends to overwater so we measure together.'),
        (${emmaId}, 'Sort Laundry by Color', 'Help sort dirty clothes into lights and darks piles', 'weekly', '2026-03-14', '2026-03-21', 'in_progress', '15 minutes extra screen time', 'Good color recognition practice. She calls it the sorting game.')
    `);
    console.log('Inserted 4 chores');

    // ─── ALLERGY LOGS ───
    await client.query(`
      INSERT INTO allergy_logs (child_id, allergen, severity, reaction, first_observed, last_reaction, treatment, is_confirmed, notes) VALUES
        (${emmaId}, 'Peanuts', 'moderate', 'Hives on face and arms, mild swelling of lips', '2024-11-12', '2024-11-12', 'Benadryl administered. EpiPen prescribed as precaution. Strict avoidance.', true, 'Confirmed by allergist skin prick test. Carry EpiPen at all times. Daycare notified.'),
        (${emmaId}, 'Dust Mites', 'mild', 'Sneezing, runny nose, itchy eyes in the morning', '2025-06-01', '2026-03-10', 'Daily Zyrtec during allergy season. HEPA filter in bedroom.', true, 'Worse in spring and fall. Wash bedding weekly in hot water.'),
        (${emmaId}, 'Cats', 'mild', 'Itchy eyes and sneezing after prolonged exposure', '2025-09-15', '2026-02-20', 'Antihistamine before known exposure. Wash hands after petting.', false, 'Suspected but not formally tested. Reacts at grandma''s house where there is a cat.')
    `);
    console.log('Inserted 3 allergy logs');

    // ─── PLAYDATES ───
    await client.query(`
      INSERT INTO playdates (child_id, friend_name, friend_age, playdate_date, start_time, end_time, location, activity, notes) VALUES
        (${emmaId}, 'Sofia Martinez', '3 years', '2026-03-15', '14:00:00', '16:00:00', 'Lincoln Park Playground', 'Playground, sandbox, and bubbles', 'Best friends from daycare. They played so well together. Sofia''s mom and I exchanged numbers.'),
        (${emmaId}, 'Noah Williams', '3.5 years', '2026-03-20', '10:00:00', '12:00:00', 'Our house - Backyard', 'Water table, sidewalk chalk, snack time', 'Neighbor kid. Need to prepare nut-free snacks. His mom will stay.'),
        (${emmaId}, 'Olivia Chen', '2.5 years', '2026-03-22', '14:00:00', '15:30:00', 'Children''s Museum', 'Museum exhibits, art room, and play area', 'Karen''s daughter. First playdate with Olivia. They met at music class.')
    `);
    console.log('Inserted 3 playdates');

    // ─── SHOPPING LISTS ───
    await client.query(`
      INSERT INTO shopping_lists (user_id, child_id, item_name, category, quantity, priority, is_purchased, estimated_cost, store, notes) VALUES
        (${userId}, ${liamId}, 'Pampers Size 4 Diapers', 'Diapering', '1 box (150 ct)', 'high', false, 42.99, 'Costco', 'Running low. Need by end of week.'),
        (${userId}, ${emmaId}, 'Sunscreen SPF 50 Kids', 'Health', '2 bottles', 'medium', false, 15.99, 'Target', 'Spring is coming. Need reef-safe, fragrance-free for sensitive skin.'),
        (${userId}, NULL, 'Organic Whole Milk', 'Groceries', '2 gallons', 'high', true, 8.99, 'Whole Foods', 'Both kids drink a lot of milk. Get organic.'),
        (${userId}, ${emmaId}, 'Rain Boots - Size 9 Toddler', 'Clothing', '1 pair', 'medium', false, 24.99, 'Target', 'She outgrew last year''s pair. Wants the ones with unicorns.'),
        (${userId}, ${liamId}, 'Teething Rings (Refrigerable)', 'Teething', '2 pack', 'high', false, 9.99, 'Amazon', 'Liam is drooling a lot. Might be teething soon.')
    `);
    console.log('Inserted 5 shopping list items');

    // ─── SUMMARY ───
    console.log('\n========================================');
    console.log('  SEED COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log('  Demo User: demo@childcare.com / password123');
    console.log('  Children: Emma (3yo) & Liam (1yo)');
    console.log('  Milestones: 20');
    console.log('  Activities: 20');
    console.log('  Health Records: 19');
    console.log('  Sleep Records: 19');
    console.log('  Feeding Records: 20');
    console.log('  Growth Records: 19');
    console.log('  Vaccinations: 26');
    console.log('  Behavioral Notes: 18');
    console.log('  Journal Entries: 17');
    console.log('  Medications: 18');
    console.log('  Appointments: 16');
    console.log('  Emergency Contacts: 16');
    console.log('  Learning Resources: 20');
    console.log('  Diaper Records: 8');
    console.log('  Expenses: 5');
    console.log('  Caregiver Logs: 3');
    console.log('  Daily Routines: 6');
    console.log('  Tooth Records: 4');
    console.log('  Photo Memories: 5');
    console.log('  Chores: 4');
    console.log('  Allergy Logs: 3');
    console.log('  Playdates: 3');
    console.log('  Shopping List Items: 5');
    console.log('  TOTAL: 294 seed records');
    console.log('========================================\n');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
