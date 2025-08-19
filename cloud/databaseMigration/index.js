/**
 * Database Migration Cloud Function for WeChat Mini Program Ride-Sharing App
 *
 * This cloud function sets up the database collections and provides migration utilities.
 * Deploy this as a cloud function and call it to initialize your new database.
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * Main migration function
 */
exports.main = async (event, context) => {
  const { action = 'migrate' } = event

  console.log(`Starting database ${action}...`)

  try {
    switch (action) {
      case 'migrate':
        return await runMigration()
      case 'check':
        return await checkCollections()
      case 'sample':
        return await insertSampleData()
      default:
        return { success: false, error: 'Invalid action' }
    }
  } catch (error) {
    console.error(`${action} failed:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Run complete migration
 */
async function runMigration() {
  console.log('Running complete migration...')

  // Step 1: Create collections
  const collectionResults = await createCollections()

  // Step 2: Log index requirements
  await logIndexRequirements()

  console.log('Database migration completed successfully!')
  return {
    success: true,
    message: 'Migration completed. Please create indexes manually in WeChat Cloud Console.',
    collections: collectionResults,
    indexRequirements: getIndexRequirements()
  }
}

/**
 * Create necessary collections
 */
async function createCollections() {
  console.log('Creating collections...')

  const collections = ['users', 'rides', 'feedback']
  const results = []

  for (const collectionName of collections) {
    try {
      // Check if collection exists by trying to query it
      await db.collection(collectionName).limit(1).get()
      console.log(`Collection '${collectionName}' already exists`)
      results.push({ collection: collectionName, status: 'exists' })
    } catch (error) {
      if (error.code === 'DATABASE_COLLECTION_NOT_EXIST') {
        try {
          await db.createCollection(collectionName)
          console.log(`Collection '${collectionName}' created successfully`)
          results.push({ collection: collectionName, status: 'created' })
        } catch (createError) {
          console.error(`Error creating collection '${collectionName}':`, createError)
          results.push({ collection: collectionName, status: 'error', error: createError.message })
        }
      } else {
        console.error(`Error checking collection '${collectionName}':`, error)
        results.push({ collection: collectionName, status: 'error', error: error.message })
      }
    }
  }

  return results
}

/**
 * Check existing collections
 */
async function checkCollections() {
  console.log('Checking collections...')

  const collections = ['users', 'rides', 'feedback']
  const results = []

  for (const collectionName of collections) {
    try {
      const result = await db.collection(collectionName).count()
      results.push({
        collection: collectionName,
        exists: true,
        count: result.total
      })
    } catch (error) {
      results.push({
        collection: collectionName,
        exists: false,
        error: error.message
      })
    }
  }

  return { success: true, collections: results }
}

/**
 * Get index requirements for manual creation
 */
function getIndexRequirements() {
  return {
    users: [
      { field: 'phone', direction: 1, description: 'For phone number lookups' },
      { field: 'wechat', direction: 1, description: 'For WeChat ID lookups' },
      { field: 'created_at', direction: -1, description: 'For chronological sorting' }
    ],
    rides: [
      { field: 'type', direction: 1, description: 'Filter by ride type (ride/request)' },
      { field: 'status', direction: 1, description: 'Filter by status (open/full/closed)' },
      { field: 'publisher_id', direction: 1, description: 'Find rides by publisher' },
      { field: 'driver_id', direction: 1, description: 'Find rides by driver' },
      { field: 'departure_date', direction: 1, description: 'Filter by departure date' },
      { field: 'created_at', direction: -1, description: 'Chronological sorting' },
      { field: 'updated_at', direction: -1, description: 'Recently updated rides' }
    ],
    feedback: [
      { field: 'user_openid', direction: 1, description: 'Find feedback by user' },
      { field: 'type', direction: 1, description: 'Filter by feedback type' },
      { field: 'status', direction: 1, description: 'Filter by status' },
      { field: 'created_at', direction: -1, description: 'Chronological sorting' }
    ],
    compound_indexes: [
      {
        collection: 'rides',
        fields: [
          { field: 'type', direction: 1 },
          { field: 'status', direction: 1 },
          { field: 'departure_date', direction: 1 }
        ],
        description: 'Main search query optimization'
      },
      {
        collection: 'rides',
        fields: [
          { field: 'publisher_id', direction: 1 },
          { field: 'status', direction: 1 }
        ],
        description: 'User ride management'
      }
    ]
  }
}

/**
 * Log index requirements
 */
async function logIndexRequirements() {
  console.log('=== INDEX REQUIREMENTS ===')
  console.log('Please create these indexes manually in WeChat Cloud Console:')

  const requirements = getIndexRequirements()

  console.log('\n--- Single Field Indexes ---')
  Object.entries(requirements).forEach(([collection, indexes]) => {
    if (Array.isArray(indexes)) {
      console.log(`\n${collection.toUpperCase()} Collection:`)
      indexes.forEach(index => {
        console.log(`  - ${index.field} (${index.direction === 1 ? 'ASC' : 'DESC'}): ${index.description}`)
      })
    }
  })

  console.log('\n--- Compound Indexes ---')
  requirements.compound_indexes.forEach(compoundIndex => {
    console.log(`\n${compoundIndex.collection.toUpperCase()} Collection:`)
    const fieldStr = compoundIndex.fields.map(f => `${f.field}(${f.direction === 1 ? 'ASC' : 'DESC'})`).join(', ')
    console.log(`  - [${fieldStr}]: ${compoundIndex.description}`)
  })

  console.log('\n=== END INDEX REQUIREMENTS ===')
}

/**
 * Insert sample data for testing
 */
async function insertSampleData() {
  console.log('Inserting sample data...')

  try {
    // Sample user data
    const sampleUser = {
      nickname: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      phone: '',
      wechat: 'test_wechat',
      created_at: db.serverDate(),
      as_driver: [],
      as_passenger: []
    }

    // Sample ride data
    const sampleRide = {
      type: 'ride',
      status: 'open',
      publisher_id: 'sample-openid-123',
      driver_id: 'sample-openid-123',
      departure_place: {
        city: 'New York, NY',
        state: 'NY',
        lat: 40.7128,
        lng: -74.0060
      },
      arrival_place: {
        city: 'Boston, MA',
        state: 'MA',
        lat: 42.3601,
        lng: -71.0589
      },
      departure_date: '2024-01-15',
      departure_time: '09:00',
      price: 50,
      empty_seats: 3,
      passenger_number: 0,
      passengers: [],
      car_model: 'Toyota Camry',
      contact_wechat: 'test_wechat',
      stopovers: [
        {
          city: 'Philadelphia, PA',
          state: 'PA',
          lat: 39.9526,
          lng: -75.1652
        }
      ],
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }

    // Insert sample data
    const userResult = await db.collection('users').add({ data: sampleUser })
    const rideResult = await db.collection('rides').add({ data: sampleRide })

    console.log('Sample data inserted successfully')
    return {
      success: true,
      userID: userResult._id,
      rideID: rideResult._id,
      message: 'Sample data inserted'
    }

  } catch (error) {
    console.error('Error inserting sample data:', error)
    return { success: false, error: error.message }
  }
}