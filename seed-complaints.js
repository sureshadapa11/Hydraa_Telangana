// =====================================================
//  seed-complaints.js — HYDRAA Sample Data Seeder
//  Run: node seed-complaints.js
// =====================================================

require('dotenv').config();
const db = require('./utils/db');

async function seed() {
  try {
    console.log('🌱 Starting complaint seed...\n');

    // ── Fetch real IDs from DB ──
    const [categories]  = await db.query('SELECT id, name FROM categories ORDER BY id');
    const [districts]   = await db.query('SELECT id, name FROM districts LIMIT 10');
    const [users]       = await db.query("SELECT id, full_name FROM users WHERE role IN ('citizen','user') ORDER BY id LIMIT 5");

    if (!categories.length) { console.error('❌ No categories found. Make sure server has run once to seed categories.'); process.exit(1); }
    if (!districts.length)  { console.error('❌ No districts found.'); process.exit(1); }
    if (!users.length)      { console.error('❌ No citizen users found. Register at least one citizen first.'); process.exit(1); }

    const catMap  = Object.fromEntries(categories.map(c => [c.name, c.id]));
    const distIds = districts.map(d => d.id);
    const userIds = users.map(u => u.id);

    const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
    const uid   = () => pick(userIds);
    const did   = () => pick(distIds);
    const catId = name => catMap[name] || categories[0].id;
    const ts    = (daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    console.log(`Found: ${categories.length} categories, ${districts.length} districts, ${users.length} users`);
    console.log('Categories:', categories.map(c => `[${c.id}] ${c.name}`).join('\n            '));
    console.log('Users:', users.map(u => `[${u.id}] ${u.full_name}`).join(', '));
    console.log('');

    const complaints = [
      {
        title: 'Illegal construction on lake buffer zone in Kukatpally',
        description: 'A multi-storey building is being constructed within the 30-metre buffer zone of Nizampet Lake. The construction started 2 months ago and heavy machinery is visible. This is destroying the natural drainage of the area and causing flooding risk to nearby residents.',
        category: 'Lake / Water Body Encroachment',
        priority: 'urgent',
        address: 'Plot No. 45, Near Nizampet Lake, Kukatpally',
        status: 'open',
        daysAgo: 2,
      },
      {
        title: 'Unauthorized commercial building blocking footpath near LB Nagar',
        description: 'A shop owner has extended his commercial structure 8 feet into the public footpath. Pedestrians are forced to walk on the busy road, causing danger especially for school children and elderly residents.',
        category: 'Road / Footpath Obstruction',
        priority: 'high',
        address: 'LB Nagar Main Road, Near Saraswati School, Rangareddy',
        status: 'assigned',
        daysAgo: 5,
      },
      {
        title: 'Sewage overflow from blocked drain near Malkajgiri colony',
        description: 'The main drain near our colony has been blocked by construction debris dumped by a contractor. Sewage has been overflowing into the street for the past 10 days. Several residents have reported health issues. Immediate action required.',
        category: 'Flooding & Drainage Issue',
        priority: 'urgent',
        address: 'Road No. 7, Malkajgiri Colony, Malkajgiri',
        status: 'in_progress',
        daysAgo: 10,
      },
      {
        title: 'Poramboke land occupied by unauthorized residents near Uppal',
        description: 'Approximately 2 acres of government poramboke land near Uppal X roads has been illegally occupied. Temporary structures and fences have been erected. This land was designated for a community park as per old records.',
        category: 'Government Land Encroachment',
        priority: 'high',
        address: 'Uppal X Roads, Survey No. 234, Uppal',
        status: 'open',
        daysAgo: 15,
      },
      {
        title: 'Massive illegal hoarding near Begumpet flyover causing distraction',
        description: 'A 40x20 feet unauthorized LED hoarding has been installed on the Begumpet flyover pillar without any NOC or permission from GHMC. The bright flashing LED lights are distracting drivers and causing traffic hazards especially at night.',
        category: 'Illegal Advertisements',
        priority: 'medium',
        address: 'Begumpet Flyover, Pillar No. 12, Begumpet',
        status: 'resolved',
        daysAgo: 25,
        resolvedAgo: 5,
      },
      {
        title: 'Building collapse risk: 3-storey structure without approval in Kondapur',
        description: 'A 3-storey residential building constructed without any building permission or structural approval is showing signs of cracking. Large cracks visible on the external walls. Residents of neighboring buildings are alarmed. Urgent structural inspection needed.',
        category: 'Disaster / Emergency',
        priority: 'urgent',
        address: 'Plot 89, Near DLF Cyber City, Kondapur',
        status: 'in_progress',
        daysAgo: 1,
      },
      {
        title: 'Park land encroached by builder — children have no play space',
        description: 'The open space reserved as a park in our layout (as per approved plan) has been fenced off by a builder who claims he purchased it. Over 300 families in the colony have no park or open space. Children used to play here every evening.',
        category: 'Park / Open Space Violation',
        priority: 'high',
        address: 'Srinagar Colony, Layout Sector 4, Dilsukhnagar',
        status: 'open',
        daysAgo: 8,
      },
      {
        title: 'Nala filled with construction material causing waterlogging',
        description: 'A natural nala running through our area has been partially filled with construction material and earth to facilitate vehicular movement to a new construction site. During last week\'s rain this caused 3 feet of waterlogging in 6 houses. The debris must be removed immediately.',
        category: 'Lake / Water Body Encroachment',
        priority: 'high',
        address: 'Near ORR Exit 14, Narsingi Village',
        status: 'assigned',
        daysAgo: 12,
      },
      {
        title: 'Vendor stalls blocking entire road near Charminar',
        description: 'Unauthorized street vendors have set up permanent stalls with heavy concrete bases on the road near Charminar south side. The road has effectively narrowed from 2 lanes to barely 1 lane, causing severe traffic jams and making ambulance access nearly impossible.',
        category: 'Road / Footpath Obstruction',
        priority: 'medium',
        address: 'South Side, Charminar Road, Old City',
        status: 'resolved',
        daysAgo: 30,
        resolvedAgo: 12,
      },
      {
        title: 'Revenue land grabbed using forged documents in Shamshabad',
        description: 'Government revenue land of 5 acres near Shamshabad has been illegally occupied using forged pattedar documents. The land is clearly marked as government property in revenue records. The occupants have built a large compound wall and are claiming ownership.',
        category: 'Government Land Encroachment',
        priority: 'urgent',
        address: 'Survey No. 789, Shamshabad Mandal, Rangareddy',
        status: 'open',
        daysAgo: 3,
      },
      {
        title: 'Illegal banners of political party covering heritage wall',
        description: 'The historic boundary wall near Nizam Museum has been completely covered with unauthorized political party banners and flex prints. This is damaging the heritage structure and is also in violation of the High Court order banning unauthorized banners.',
        category: 'Illegal Advertisements',
        priority: 'medium',
        address: 'Near Nizam Museum, Purani Haveli, Hyderabad',
        status: 'rejected',
        daysAgo: 20,
      },
      {
        title: 'Excess floors built in residential area violating FSI rules',
        description: 'A builder has constructed a 7-storey apartment complex in a residential zone that permits only G+3. The additional 3 floors are completely unauthorized. GHMC had issued a notice 6 months ago but no action was taken. The building is now occupied by residents.',
        category: 'Illegal Construction',
        priority: 'high',
        address: 'Plot 22, Road No. 4, Banjara Hills',
        status: 'in_progress',
        daysAgo: 45,
      },
      {
        title: 'Storm drain blocked by restaurant kitchen waste near Jubilee Hills',
        description: 'A restaurant owner has connected kitchen waste water and solid waste directly into the open storm drain on the main road. The drain is now completely blocked with food waste and grease, causing overflow during even light rain. The smell is unbearable for nearby residents.',
        category: 'Flooding & Drainage Issue',
        priority: 'medium',
        address: 'Road No. 36, Jubilee Hills, Hyderabad',
        status: 'open',
        daysAgo: 7,
      },
      {
        title: 'Tree fell on compound wall — urgent clearance needed',
        description: 'A massive old neem tree fell on a private compound wall during yesterday\'s heavy wind. Parts of the tree are also blocking the lane making it inaccessible. No injuries reported but the hanging branches pose danger to passersby. Request immediate clearance.',
        category: 'Disaster / Emergency',
        priority: 'urgent',
        address: 'Lane 5, Basheer Bagh Colony, Basheer Bagh',
        status: 'resolved',
        daysAgo: 6,
        resolvedAgo: 2,
      },
      {
        title: 'Playground converted to parking lot by apartment builder',
        description: 'The children\'s playground in Greenfields Apartment complex, which was shown in the approved building plan as mandatory open space, has been converted into paid parking by the builder. Over 200 children have no place to play and parents have been complaining for a year.',
        category: 'Park / Open Space Violation',
        priority: 'medium',
        address: 'Greenfields Apartment, Miyapur Main Road, Miyapur',
        status: 'assigned',
        daysAgo: 18,
      },
      {
        title: 'Unauthorized construction on FTL of Hussain Sagar',
        description: 'Concrete pillars for what appears to be a commercial structure have been erected within the Full Tank Level boundary of Hussain Sagar Lake. This is in clear violation of GO Ms. No. 111 and the court orders protecting the lake. Work is progressing rapidly.',
        category: 'Lake / Water Body Encroachment',
        priority: 'urgent',
        address: 'Near Lumbini Park Gate, Tank Bund Road, Hyderabad',
        status: 'in_progress',
        daysAgo: 4,
      },
      {
        title: 'Digital billboard installed without NOC on national highway',
        description: 'A large digital billboard (approximately 50x30 feet) has been installed on the median of NH-44 near Gachibowli without any NOC from NHAI or GHMC. The rotating LED display is blinding drivers coming from opposite direction especially after dark.',
        category: 'Illegal Advertisements',
        priority: 'high',
        address: 'NH-44, Near Gachibowli Signal, Gachibowli',
        status: 'open',
        daysAgo: 9,
      },
      {
        title: 'Setback rules violated — neighbour\'s construction touching boundary',
        description: 'My neighbour is constructing a building that has zero setback on my side, in clear violation of building regulations that require minimum 3 metres. They have also started digging my side of the compound wall foundation. Despite repeated requests they have not stopped.',
        category: 'Illegal Construction',
        priority: 'medium',
        address: 'H.No. 14-A, Sai Nagar, Boduppal, Medchal-Malkajgiri',
        status: 'open',
        daysAgo: 11,
      },
      {
        title: 'Long-term encroachment of government land near Tolichowki',
        description: 'A commercial establishment has been operating on government land for the past 15 years near Tolichowki. The land was allotted temporarily but the occupants refuse to vacate. Multiple notices have been issued but no action taken. The establishment has now built a permanent 2-storey structure.',
        category: 'Government Land Encroachment',
        priority: 'low',
        address: 'Survey No. 112, Tolichowki Main Road, Tolichowki',
        status: 'resolved',
        daysAgo: 60,
        resolvedAgo: 15,
      },
      {
        title: 'Footpath encroached by flower vendors near Secunderabad station',
        description: 'The entire footpath on the west side of Secunderabad railway station has been taken over by unauthorized flower and fruit vendors who have installed semi-permanent metal structures. Commuters especially senior citizens are forced to walk on the busy road.',
        category: 'Road / Footpath Obstruction',
        priority: 'low',
        address: 'West Side, Secunderabad Railway Station, Secunderabad',
        status: 'open',
        daysAgo: 22,
      },
    ];

    let inserted = 0;
    let skipped  = 0;

    for (const c of complaints) {
      const complaint_no = `HYD${Date.now()}${Math.floor(Math.random() * 9999)}`;
      const created_at   = ts(c.daysAgo);
      const resolved_at  = c.resolvedAgo ? ts(c.resolvedAgo) : null;
      const user_id      = uid();
      const district_id  = did();
      const category_id  = catId(c.category);

      try {
        const [result] = await db.query(`
          INSERT INTO complaints
            (complaint_no, user_id, title, description, category_id, priority,
             address, district_id, status, created_at, resolved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [complaint_no, user_id, c.title, c.description, category_id,
            c.priority, c.address, district_id, c.status, created_at, resolved_at]);

        const cid = result.insertId;

        // Add history entry
        await db.query(`
          INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks, changed_at)
          VALUES (?, NULL, 'open', ?, 'citizen', 'Complaint lodged', ?)
        `, [cid, user_id, created_at]).catch(() => {});

        if (c.status !== 'open') {
          await db.query(`
            INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by_id, changed_by_role, remarks, changed_at)
            VALUES (?, 'open', ?, 1, 'admin', 'Status updated by admin', NOW())
          `, [cid, c.status]).catch(() => {});
        }

        console.log(`  ✅ [${String(inserted+1).padStart(2,'0')}] ${c.status.toUpperCase().padEnd(12)} | ${c.priority.padEnd(7)} | ${c.title.substring(0,55)}`);
        inserted++;
      } catch (err) {
        console.log(`  ⚠️  Skipped: ${c.title.substring(0,50)} — ${err.message}`);
        skipped++;
      }

      await new Promise(r => setTimeout(r, 30)); // avoid duplicate complaint_no timestamps
    }

    console.log(`\n✅ Done! Inserted ${inserted} complaints, skipped ${skipped}.`);
    console.log('📊 Status breakdown:');
    const [stats] = await db.query(`
      SELECT status, COUNT(*) AS cnt FROM complaints GROUP BY status ORDER BY cnt DESC
    `);
    stats.forEach(s => console.log(`   ${s.status.padEnd(12)} : ${s.cnt}`));
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
