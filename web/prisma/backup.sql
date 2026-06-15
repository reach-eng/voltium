PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO Admin VALUES('cmpbttcbm0000ub6dj9y2tap5','superadmin@voltium.in','$pbkdf2$100000$AxuXnGqsK2+q3J4belXxew==$3CvoJ0RE9TcUU0wIWY5PuRInqUxOWh7O6IWNjaHDC6o=','Super Admin','SUPER_ADMIN',1,NULL,'[]',1779146374306,1779146374306);
INSERT INTO Admin VALUES('cmpbttcbr0001ub6d7h3dr7jt','admin@voltium.in','$pbkdf2$100000$AxuXnGqsK2+q3J4belXxew==$3CvoJ0RE9TcUU0wIWY5PuRInqUxOWh7O6IWNjaHDC6o=','Rajesh Kumar','ADMIN',1,NULL,'[]',1779146374311,1779146374311);
INSERT INTO Admin VALUES('cmpbttcbs0002ub6dx65bcazk','ops@voltium.in','$pbkdf2$100000$AxuXnGqsK2+q3J4belXxew==$3CvoJ0RE9TcUU0wIWY5PuRInqUxOWh7O6IWNjaHDC6o=','Priya Singh','ADMIN',1,NULL,'[]',1779146374313,1779146374313);
CREATE TABLE IF NOT EXISTS "Hub" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO Hub VALUES('hub-delhi-central','New Delhi Central','Connaught Place, New Delhi','Delhi',1,1779146374315,1779146374315);
INSERT INTO Hub VALUES('hub-delhi-east','East Delhi Hub','Laxmi Nagar, Delhi','Delhi',1,1779146374317,1779146374317);
INSERT INTO Hub VALUES('hub-gurgaon','Gurgaon Sector 29','Sector 29, Gurgaon','Gurgaon',1,1779146374319,1779146374319);
CREATE TABLE IF NOT EXISTS "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "licensePlate" TEXT,
    "batteryLevel" INTEGER NOT NULL DEFAULT 100,
    "batteryPartner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "hubId" TEXT NOT NULL,
    "assignedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vehicle_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO Vehicle VALUES('vh-001','VF-VH-001','DL 04 AB 1234','Volt MX-4',NULL,100,'Battery Smart','ASSIGNED','hub-delhi-central',NULL,1779146374321,1779146980894);
INSERT INTO Vehicle VALUES('vh-002','VF-VH-002','DL 04 AB 1235','Volt MX-4',NULL,100,'Mooving','ASSIGNED','hub-delhi-central',NULL,1779146374324,1779146374324);
INSERT INTO Vehicle VALUES('vh-003','VF-VH-003','DL 04 AB 1236','Volt MX-3',NULL,100,'Battery Smart','MAINTENANCE','hub-delhi-central',NULL,1779146374326,1779146374326);
INSERT INTO Vehicle VALUES('vh-004','VF-VH-004','DL 04 CD 5678','Ather 450X Gen3',NULL,100,'Battery Smart','ASSIGNED','hub-delhi-east',NULL,1779146374328,1779168154064);
INSERT INTO Vehicle VALUES('vh-005','VF-VH-005','DL 04 CD 5679','Ather 450X Gen3',NULL,100,'Mooving','RENTED','hub-delhi-east',NULL,1779146374330,1779146374330);
INSERT INTO Vehicle VALUES('vh-006','VF-VH-006','HR 26 AB 4321','Volt MX-4',NULL,100,'Battery Smart','AVAILABLE','hub-gurgaon',NULL,1779146374332,1779146374332);
INSERT INTO Vehicle VALUES('vh-007','VF-VH-007','HR 26 AB 4322','Volt MX-3',NULL,100,'Mooving','RETIRED','hub-gurgaon',NULL,1779146374334,1779146374334);
INSERT INTO Vehicle VALUES('vh-008','VF-VH-008','DL 04 EF 9012','Ather 450X Gen3',NULL,100,'Battery Smart','AVAILABLE','hub-delhi-central',NULL,1779146374335,1779146374335);
CREATE TABLE IF NOT EXISTS "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxBookings" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO Shift VALUES('shift-morning','Morning','06:00','14:00',5,1,1779146374343,1779146374343);
INSERT INTO Shift VALUES('shift-afternoon','Afternoon','14:00','22:00',5,1,1779146374346,1779146374346);
INSERT INTO Shift VALUES('shift-night','Night','22:00','06:00',3,1,1779146374347,1779146374347);
CREATE TABLE IF NOT EXISTS "rental_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO rental_plans VALUES('plan-daily','Daily Plan','DAILY',39900,1,'Perfect for short trips and first-time riders',1,1779146374336,1779146374336);
INSERT INTO rental_plans VALUES('plan-weekly','Weekly Premium','WEEKLY',219900,7,'Best value for regular delivery riders',1,1779146374337,1779146374337);
INSERT INTO rental_plans VALUES('plan-weekly-lite','Weekly Lite','WEEKLY',159900,7,'Budget-friendly weekly option',1,1779146374338,1779146374338);
INSERT INTO rental_plans VALUES('plan-monthly','Monthly Pro','MONTHLY',749900,30,'Maximum savings for committed riders',1,1779146374339,1779146374339);
CREATE TABLE IF NOT EXISTS "Rider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "dob" TEXT,
    "currentAddress" TEXT,
    "intent" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ONBOARDING',
    "vehicleId" TEXT,
    "deliveryId" TEXT,
    "assignedVehicle" TEXT,
    "pickupHub" TEXT,
    "planStatus" TEXT NOT NULL DEFAULT 'NONE',
    "currentPlan" TEXT,
    "planStartDate" DATETIME,
    "planEndDate" DATETIME,
    "rentalStatus" TEXT NOT NULL DEFAULT 'NONE',
    "preferredShift" TEXT,
    "teamLeader" TEXT,
    "emergencyContact" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "locationGranted" BOOLEAN NOT NULL DEFAULT false,
    "batteryGranted" BOOLEAN NOT NULL DEFAULT false,
    "contactsGranted" BOOLEAN NOT NULL DEFAULT false,
    "callLogsGranted" BOOLEAN NOT NULL DEFAULT false,
    "micGranted" BOOLEAN NOT NULL DEFAULT false,
    "cameraGranted" BOOLEAN NOT NULL DEFAULT false,
    "phoneGranted" BOOLEAN NOT NULL DEFAULT false,
    "registrationDone" BOOLEAN NOT NULL DEFAULT false,
    "depositDone" BOOLEAN NOT NULL DEFAULT false,
    "kycDone" BOOLEAN NOT NULL DEFAULT false,
    "planDone" BOOLEAN NOT NULL DEFAULT false,
    "pickupDone" BOOLEAN NOT NULL DEFAULT false,
    "pickedUpAt" DATETIME,
    "registrationDoneAt" DATETIME,
    "depositDoneAt" DATETIME,
    "kycDoneAt" DATETIME,
    "planDoneAt" DATETIME,
    "accountStatus" TEXT NOT NULL DEFAULT 'PRE_ACTIVE',
    "fcmToken" TEXT,
    "isAdminLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockPassword" TEXT,
    "isUninstallBlocked" BOOLEAN NOT NULL DEFAULT true,
    "isLocationMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isAppsControlRestricted" BOOLEAN NOT NULL DEFAULT true,
    "deviceAdminGranted" BOOLEAN NOT NULL DEFAULT false,
    "displayOverlayGranted" BOOLEAN NOT NULL DEFAULT false,
    "lastDeviceViolationAt" DATETIME,
    "deviceViolationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "currentPlanPrice" INTEGER,
    "pickupPhotoFront" TEXT,
    "pickupPhotoBack" TEXT,
    "pickupPhotoLeft" TEXT,
    "pickupPhotoRight" TEXT,
    "pickupPhotoWithVehicle" TEXT,
    "lastKnownLat" REAL,
    "lastKnownLng" REAL,
    "lastLocationAt" DATETIME,
    "batteryLevel" INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT "Rider_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO Rider VALUES('rider-1','VF-RD-001','9999900001','Arjun Sharma','arjun.sharma@gmail.com','Rajesh Sharma',NULL,'15-05-1998',NULL,'deliver','POST_ACTIVE',NULL,NULL,'VF-VH-002','New Delhi Central','ACTIVE','Weekly Premium',1778973574354,1779578374355,'ACTIVE',NULL,'Amit Sharma',NULL,'ARJUN2024',NULL,1,1,1,0,0,0,1,0,1,1,1,1,NULL,NULL,NULL,NULL,NULL,'ACTIVE',NULL,0,NULL,1,1,1,0,0,NULL,0,1779146374357,1779146374357,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,100);
INSERT INTO Rider VALUES('rider-2','VF-RD-002','9999900002','Deepak Verma','deepak.verma@gmail.com','Manoj Verma',NULL,'20-11-2000',NULL,'deliver','PRE_ACTIVE',NULL,NULL,NULL,'East Delhi Hub','NONE',NULL,NULL,NULL,'NONE',NULL,NULL,NULL,'DEEPAK2024',NULL,1,0,0,0,0,0,0,0,0,0,0,0,NULL,NULL,NULL,NULL,NULL,'PRE_ACTIVE',NULL,0,NULL,1,1,1,0,0,NULL,0,1779146374361,1779146374361,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,100);
INSERT INTO Rider VALUES('rider-3','VF-RD-003','9999900003','Priyanka Gupta','priyanka.gupta@gmail.com','Anil Gupta',NULL,'10-03-1996',NULL,'personal','POST_ACTIVE',NULL,NULL,'VF-VH-005','Gurgaon Sector 29','ACTIVE','Monthly Pro',1777850374355,1780442374355,'ACTIVE',NULL,'Suresh Patel',NULL,'PRIYA2024','ARJUN2024',1,1,0,0,0,1,1,0,1,1,1,1,NULL,NULL,NULL,NULL,NULL,'ACTIVE',NULL,0,NULL,1,1,1,0,0,NULL,0,1779146374365,1779146374365,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,100);
INSERT INTO Rider VALUES('rider-4','VF-RD-004','9999900004','Rohit Mehta','rohit.mehta@gmail.com',NULL,NULL,'25-08-1995',NULL,'deliver','SUSPENDED',NULL,NULL,'VF-VH-003','New Delhi Central','EXPIRED',NULL,NULL,NULL,'RETURN_REQUIRED',NULL,NULL,NULL,'ROHIT2024',NULL,1,0,0,0,0,0,0,0,1,1,1,1,NULL,NULL,NULL,NULL,NULL,'SUSPENDED',NULL,0,NULL,1,1,1,0,0,NULL,0,1779146374368,1779146374368,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,100);
INSERT INTO Rider VALUES('rider-5','VF-RD-005','9999900005','Neha Singh','neha.singh@gmail.com',NULL,NULL,'05-12-1999',NULL,'deliver','ONBOARDING',NULL,NULL,NULL,NULL,'NONE',NULL,NULL,NULL,'NONE',NULL,NULL,NULL,'NEHA2024',NULL,1,0,0,0,0,0,0,0,0,0,0,0,NULL,NULL,NULL,NULL,NULL,'PRE_ACTIVE',NULL,0,NULL,1,1,1,0,0,NULL,0,1779146374372,1779146374372,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,100);
INSERT INTO Rider VALUES('rider-6','VF-RD-006','9999900006','Manish Kumar','manish.kumar@gmail.com',NULL,NULL,'18-06-1997',NULL,'personal','POST_ACTIVE',NULL,NULL,'VF-VH-004','East Delhi Hub','ACTIVE','Weekly Premium',1778714374355,1779319174355,'ACTIVE',NULL,'Rahul Kumar',NULL,'MANISH2024',NULL,1,1,1,1,1,1,1,0,1,1,1,1,NULL,NULL,NULL,NULL,NULL,'ACTIVE',NULL,0,NULL,1,1,1,0,0,NULL,0,1779146374376,1779146374376,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,100);
INSERT INTO Rider VALUES('cmpbtv4t4007iubmks8g64b6n','VF-RD-9B5461D9','7788888801','Test Rider','test@example.com','Test Father','Test Mother','01-01-2000','','deliver','ONBOARDING',NULL,NULL,NULL,NULL,'ACTIVE','Monthly Pro',1779146621004,1781738621004,'NONE',NULL,NULL,NULL,'8801-D27E',NULL,1,1,1,1,1,1,1,1,1,0,1,0,NULL,1779146457879,1779146751991,NULL,1779146621010,'PRE_ACTIVE',NULL,0,NULL,1,1,1,0,0,NULL,0,1779146457880,1779146751992,749900,NULL,NULL,NULL,NULL,NULL,37.4219982999999985,-122.0840000000000031,1779146734997,100);
INSERT INTO Rider VALUES('cmpbu6cch0081ubmkvb4893z2','VF-RD-E435FE4A','9876543210','Test Rider',NULL,NULL,NULL,NULL,NULL,NULL,'ACTIVE','vh-004',NULL,'DL 04 CD 5678',NULL,'ACTIVE','Weekly Premium',1779168154058,1779772954058,'ACTIVE',NULL,NULL,NULL,'3210-2B68',NULL,1,1,1,1,1,1,1,1,1,1,1,1,1779168154058,1779168154058,1779168154058,1779168154058,1779168154058,'ACTIVE',NULL,0,NULL,1,1,1,0,0,NULL,0,1779146980865,1779168945220,NULL,NULL,NULL,NULL,NULL,NULL,37.4219982999999985,-122.0840000000000031,1779168945219,100);
INSERT INTO Rider VALUES('cmpbv1kbb008iubmktv0q6q1z','VF-RD-9376DA99','9999999991','',NULL,NULL,NULL,NULL,NULL,'deliver','ONBOARDING',NULL,NULL,NULL,NULL,'NONE',NULL,NULL,NULL,'NONE',NULL,NULL,NULL,'9991-9B47',NULL,1,1,1,1,1,1,1,1,0,0,0,0,NULL,1779148437526,NULL,NULL,NULL,'PRE_ACTIVE',NULL,0,NULL,1,1,1,0,0,NULL,0,1779148437527,1779150435464,NULL,NULL,NULL,NULL,NULL,NULL,37.4219982999999985,-122.0840000000000031,1779150435463,100);
CREATE TABLE IF NOT EXISTS "VehicleReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "photoFront" TEXT,
    "photoBack" TEXT,
    "photoLeft" TEXT,
    "photoRight" TEXT,
    "photoSpeedometer" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "reason" TEXT,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VehicleReturn_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VehicleReturn_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "KycProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "profilePhoto" TEXT,
    "riderPhoto" TEXT,
    "signature" TEXT,
    "aadhaarFront" TEXT,
    "aadhaarBack" TEXT,
    "aadhaarNumber" TEXT,
    "panCard" TEXT,
    "panNumber" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KycProfile_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO KycProfile VALUES('cmpbttcdn0004ub6dgrg0hr6v','rider-1','APPROVED','https://placehold.co/400x400/0053c1/white?text=Arjun+Sharma',NULL,'https://placehold.co/400x200/ffffff/000000?text=Arjun+Sig','https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Front','https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Back','1234-5678-9012','https://placehold.co/600x400/f3f4f6/191c1e?text=PAN+Card','ABCDE1234F','SBI','1234567890','SBIN0001234',NULL,1779146374379,1779146374379);
INSERT INTO KycProfile VALUES('cmpbttcdp0006ub6dtvgj58mv','rider-3','APPROVED','https://placehold.co/400x400/2f6dde/white?text=Priyanka+Gupta',NULL,'https://placehold.co/400x200/ffffff/000000?text=Priyanka+Sig','https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Front','https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Back','9876-5432-1098','https://placehold.co/600x400/f3f4f6/191c1e?text=PAN+Card','FGHIJ5678K','HDFC','9876543210','HDFC0005678',NULL,1779146374381,1779146374381);
INSERT INTO KycProfile VALUES('cmpbttcdr0008ub6d3ilpmrwx','rider-4','APPROVED','https://placehold.co/400x400/565e74/white?text=Rohit+Mehta',NULL,'https://placehold.co/400x200/ffffff/000000?text=Rohit+Sig','https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Front','https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Back','1111-2222-3333','https://placehold.co/600x400/f3f4f6/191c1e?text=PAN+Card','LMNOP9012Q','ICICI','1122334455','ICIC0009012',NULL,1779146374383,1779146374383);
INSERT INTO KycProfile VALUES('cmpbttcdt000aub6dn1wsnaeu','rider-6','APPROVED','https://placehold.co/400x400/16a34a/white?text=Manish+Kumar',NULL,'https://placehold.co/400x200/ffffff/000000?text=Manish+Sig','https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Front','https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Back','4444-5555-6666','https://placehold.co/600x400/f3f4f6/191c1e?text=PAN+Card','RSTUV3456W','Axis','5566778899','UTIB0003456',NULL,1779146374386,1779146374386);
INSERT INTO KycProfile VALUES('cmpbtxx52007qubmka9yka6sm','cmpbtv4t4007iubmks8g64b6n','SUBMITTED','mock_url_selfie.png',NULL,'mock_url_signature.png','mock_url_front.png','mock_url_back.png',NULL,'mock_url_pan.png',NULL,'','','',NULL,1779146587910,1779146587910);
CREATE TABLE IF NOT EXISTS "Guarantor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "name" TEXT,
    "relation" TEXT,
    "dob" TEXT,
    "phone" TEXT,
    "aadhaarFront" TEXT,
    "aadhaarBack" TEXT,
    "pan" TEXT,
    "video" TEXT,
    "signature" TEXT,
    "address" TEXT,
    "photo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fatherName" TEXT,
    "motherName" TEXT,
    CONSTRAINT "Guarantor_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO Guarantor VALUES('cmpbttcdv000cub6d2qde119p','rider-1','APPROVED','Vikram Sharma','Father','20-03-1970','9876543210',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1779146374388,1779146374388,NULL,NULL);
INSERT INTO Guarantor VALUES('cmpbttce3000eub6duual6d7v','rider-3','APPROVED','Rakesh Gupta','Brother','12-07-1993','9876587654',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1779146374396,1779146374396,NULL,NULL);
INSERT INTO Guarantor VALUES('cmpbttce5000gub6d6g22hhnm','rider-4','APPROVED','Sunil Mehta','Father','08-11-1968','9876511100',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1779146374398,1779146374398,NULL,NULL);
INSERT INTO Guarantor VALUES('cmpbttce7000iub6dy4gur58w','rider-6','APPROVED','Ravi Kumar','Uncle','25-01-1975','9876522233',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1779146374399,1779146374399,NULL,NULL);
INSERT INTO Guarantor VALUES('cmpbtxz7x007submkhacurr9b','cmpbtv4t4007iubmks8g64b6n','SUBMITTED','Test Guarantor','Other','','9998887776','mock_url_front.png','mock_url_back.png','mock_url_pan.png','mock_url_video.mp4','mock_url_signature.png','','mock_url_photo.png',1779146590605,1779146590605,'Test Father','Test Mother');
INSERT INTO Guarantor VALUES('cmpbu6cdc0083ubmkjmupxvxe','cmpbu6cch0081ubmkvb4893z2','VERIFIED','Test Guarantor','Father',NULL,'9876543211',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1779146980896,1779168154065,NULL,NULL);
CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "balanceInPaise" INTEGER NOT NULL DEFAULT 0,
    "securityDeposit" INTEGER NOT NULL DEFAULT 0,
    "depositStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStreak" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO Wallet VALUES('cmpbttce9000kub6dtqdw8jm2','rider-1',250000,500000,'APPROVED',12,1,1779146374401,1779146374401);
INSERT INTO Wallet VALUES('cmpbttceb000mub6dhtz4dmnn','rider-2',0,0,'PENDING',0,1,1779146374403,1779146374403);
INSERT INTO Wallet VALUES('cmpbttced000oub6dr84wye7d','rider-3',120000,500000,'APPROVED',8,1,1779146374405,1779146374405);
INSERT INTO Wallet VALUES('cmpbttcef000qub6d93c31gnt','rider-4',20000,500000,'APPROVED',3,1,1779146374407,1779146374407);
INSERT INTO Wallet VALUES('cmpbttceg000sub6dezfaadqo','rider-5',0,0,'PENDING',0,1,1779146374409,1779146374409);
INSERT INTO Wallet VALUES('cmpbttcei000uub6d8iwdj9v2','rider-6',380000,500000,'APPROVED',20,1,1779146374410,1779146374410);
INSERT INTO Wallet VALUES('cmpbtv4t9007kubmk7fjlifqx','cmpbtv4t4007iubmks8g64b6n',800000,200000,'PAID',0,4,1779146457886,1779146751994);
INSERT INTO Wallet VALUES('cmpbu6cdh0085ubmk1ejhaf56','cmpbu6cch0081ubmkvb4893z2',0,0,'PENDING',0,1,1779146980901,1779146980901);
INSERT INTO Wallet VALUES('cmpbv1kbh008kubmkolnaszni','cmpbv1kbb008iubmktv0q6q1z',0,0,'PENDING',0,1,1779148437533,1779148437533);
CREATE TABLE IF NOT EXISTS "RentalLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "leaseDate" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "basePrice" INTEGER NOT NULL,
    "finalPrice" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalLease_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalLease_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalLease_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "reason" TEXT,
    "method" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "upiRef" TEXT,
    "receipt" TEXT,
    "proofUrl" TEXT,
    "remark" TEXT,
    "description" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "Transaction" VALUES('cmpbttcek000wub6d4ummvjkz','rider-1','CREDIT',300000,'TOP_UP','Wallet Top-up','UPI','APPROVED',NULL,NULL,NULL,NULL,'Wallet top-up via UPI',NULL,NULL,NULL,1778541574411);
INSERT INTO "Transaction" VALUES('cmpbttcen000yub6den26cnim','rider-1','DEBIT',219900,'RENTAL_FEE','Weekly Premium Plan','SYSTEM','APPROVED',NULL,NULL,NULL,NULL,'Weekly Premium + GST',NULL,NULL,NULL,1778973574411);
INSERT INTO "Transaction" VALUES('cmpbttcep0010ub6djl18mmag','rider-1','CREDIT',50000,'REFUND','Late refund','SYSTEM','APPROVED',NULL,NULL,NULL,NULL,'Refund for service delay',NULL,NULL,NULL,1779059974411);
INSERT INTO "Transaction" VALUES('cmpbttces0012ub6djw952kz6','rider-1','DEBIT',5000,'PENALTY','Late return fee','SYSTEM','PENDING',NULL,NULL,NULL,NULL,'Late return penalty (2 hours)',NULL,NULL,NULL,1779103174411);
INSERT INTO "Transaction" VALUES('cmpbttcev0014ub6d5bh67xg7','rider-2','CREDIT',500000,'SECURITY_DEPOSIT','Security Deposit','UPI','PENDING',NULL,NULL,NULL,NULL,'Security deposit payment',NULL,NULL,NULL,1778887174411);
INSERT INTO "Transaction" VALUES('cmpbttcey0016ub6ds4rtterf','rider-3','CREDIT',749900,'TOP_UP','Monthly Plan Top-up','UPI','APPROVED',NULL,NULL,NULL,NULL,'Monthly Pro plan payment',NULL,NULL,NULL,1777850374411);
INSERT INTO "Transaction" VALUES('cmpbttcf10018ub6dkd3y49b2','rider-3','CREDIT',50000,'REWARD','Referral Bonus','SYSTEM','APPROVED',NULL,NULL,NULL,NULL,'Referral reward: NEHA2024',NULL,NULL,NULL,1778282374411);
INSERT INTO "Transaction" VALUES('cmpbttcf4001aub6d9aqh66rf','rider-4','CREDIT',500000,'SECURITY_DEPOSIT','Security Deposit','UPI','APPROVED',NULL,NULL,NULL,NULL,'Security deposit payment',NULL,NULL,NULL,1776554374411);
INSERT INTO "Transaction" VALUES('cmpbttcf6001cub6djkmt4qh2','rider-6','CREDIT',500000,'SECURITY_DEPOSIT','Security Deposit','UPI','APPROVED',NULL,NULL,NULL,NULL,'Security deposit payment',NULL,NULL,NULL,1775258374411);
INSERT INTO "Transaction" VALUES('cmpbttcf8001eub6ddfu7j1ic','rider-6','CREDIT',439800,'TOP_UP','Wallet Top-up','UPI','PENDING',NULL,NULL,NULL,NULL,'Wallet top-up via UPI',NULL,NULL,NULL,1779124774411);
INSERT INTO "Transaction" VALUES('cmpbtycak007uubmkwptpjymv','cmpbtv4t4007iubmks8g64b6n','CREDIT',200000,'SECURITY_DEPOSIT',NULL,'UPI','APPROVED',NULL,NULL,'https://mock-storage.voltium.in/test-upload-TOPUP_PROOF.png',NULL,NULL,NULL,NULL,NULL,1779146607548);
INSERT INTO "Transaction" VALUES('cmpbtymoh007wubmk1b6028up','cmpbtv4t4007iubmks8g64b6n','DEBIT',749900,'RENTAL_FEE',NULL,NULL,'SUCCESS',NULL,NULL,NULL,NULL,'Plan subscription: Monthly Pro',NULL,NULL,NULL,1779146621009);
INSERT INTO "Transaction" VALUES('cmpbu1fqq0080ubmklmef1c17','cmpbtv4t4007iubmks8g64b6n','CREDIT',200000,'SECURITY_DEPOSIT',NULL,'UPI','APPROVED',NULL,NULL,'https://mock-storage.voltium.in/test-upload-TOPUP_PROOF.png',NULL,NULL,NULL,NULL,NULL,1779146751986);
CREATE TABLE IF NOT EXISTS "TransactionBreakdown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CHARGE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransactionBreakdown_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "SyncQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" DATETIME
);
CREATE TABLE IF NOT EXISTS "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "troubleshootPath" TEXT,
    "assignedTo" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "attachments" TEXT,
    CONSTRAINT "SupportTicket_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO SupportTicket VALUES('cmpbttcfc001gub6dggl87egn','#1001','rider-1',NULL,'VEHICLE','HIGH','Battery not charging','Vehicle VF-VH-002 battery is not charging at Battery Smart station.','IN_PROGRESS',NULL,'admin@voltium.in',NULL,1778973574439,1779146374441,NULL);
INSERT INTO SupportTicket VALUES('cmpbttcff001iub6d32q6x2tn','#1002','rider-3',NULL,'PAYMENT','MEDIUM','Amount deducted but plan not activated','I paid ₹7499 for Monthly Pro but it shows as pending.','OPEN',NULL,NULL,NULL,1779059974439,1779146374443,NULL);
INSERT INTO SupportTicket VALUES('cmpbttcfi001kub6dw2marl29','#1003','rider-4',NULL,'GENERAL','LOW','KYC update request','I need to update my address details.','RESOLVED',NULL,'ops@voltium.in',1778714374439,1778541574439,1779146374446,NULL);
INSERT INTO SupportTicket VALUES('cmpbttcfk001mub6dx9ig118s','#1004','rider-2',NULL,'TECHNICAL','MEDIUM','App crashing on OTP screen','The app crashes every time I try to enter OTP.','OPEN',NULL,NULL,NULL,1779131974439,1779146374449,NULL);
INSERT INTO SupportTicket VALUES('cmpbttcfo001oub6d38uhlr4a','#1005','rider-6',NULL,'TROUBLESHOOTER','HIGH','Vehicle making unusual noise','Vehicle VF-VH-004 making grinding noise from rear wheel.','IN_PROGRESS',NULL,'admin@voltium.in',NULL,1779117574439,1779146374452,NULL);
CREATE TABLE IF NOT EXISTS "TicketMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "deepLink" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO Notification VALUES('cmpbttcge0026ub6d6rpb5wez','rider-1','Plan Expiring Soon','Your Weekly Premium plan expires in 5 days. Renew now.','ALERT','NORMAL',NULL,0,1779146374478);
INSERT INTO Notification VALUES('cmpbttcgg0028ub6dakddkm4p','rider-1','Payment Received','Your wallet top-up of ₹3,000 has been credited.','PAYMENT','NORMAL',NULL,1,1779146374480);
INSERT INTO Notification VALUES('cmpbttcgh002aub6dktp1d8az','rider-3','Reward Earned!','You earned 500 points for referring a friend.','PROMOTION','NORMAL',NULL,0,1779146374481);
INSERT INTO Notification VALUES('cmpbttcgj002cub6dqxrss72e','rider-2','KYC Pending','Please complete your KYC verification.','INFO','NORMAL',NULL,0,1779146374484);
INSERT INTO Notification VALUES('cmpbttcgl002eub6dx23ux9d2','rider-4','Account Suspended','Your account has been suspended.','ALERT','NORMAL',NULL,1,1779146374485);
INSERT INTO Notification VALUES('cmpbttcgm002gub6d7fmke44z','rider-6','Maintenance Reminder','Vehicle VF-VH-004 is due for scheduled maintenance.','INFO','NORMAL',NULL,0,1779146374486);
CREATE TABLE IF NOT EXISTS "offers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSponsored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO offers VALUES('offer-1','Zero Processing Fees','No processing fees on your next weekly lease renewal.','Zap',1779146374454,1781738374454,1,1,1779146374455,1779146374455);
INSERT INTO offers VALUES('offer-2','Refer & Earn ₹500','Invite friends and earn ₹500 for each successful referral.','Gift',1779146374454,1786922374454,1,0,1779146374458,1779146374458);
INSERT INTO offers VALUES('offer-3','Weekend Warrior','Get 20% off on Daily Plans booked for weekends.','Calendar',1778541574454,1784330374454,1,0,1779146374460,1779146374460);
INSERT INTO offers VALUES('offer-4','First Ride Free','New riders get their first daily plan completely free.','Star',1779146374454,1780442374454,0,1,1779146374462,1779146374462);
CREATE TABLE IF NOT EXISTS "coupons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "minAmount" INTEGER,
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO coupons VALUES('cmpbttcfz001pub6dpxtrepso','WELCOME100','₹100 off for new riders','fixed',100,500,1000,15,1779146374463,1786922374463,1,1779146374464,1779146374464);
INSERT INTO coupons VALUES('cmpbttcg2001qub6d6ttc1806','WEEKEND20','20% off on weekend plans','percentage',20,399,500,30,1779146374463,1784330374463,1,1779146374466,1779146374466);
INSERT INTO coupons VALUES('cmpbttcg3001rub6ddposjrwh','REFER500','Flat ₹500 off on weekly plan','fixed',500,1599,200,14,1779146374463,1783034374463,1,1779146374468,1779146374468);
INSERT INTO coupons VALUES('cmpbttcg5001sub6d33anamae','EXPIRED50','₹50 off - expired','fixed',50,200,100,29,1773962374463,1778282374463,0,1779146374469,1779146374469);
CREATE TABLE IF NOT EXISTS "rewards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rewards_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO rewards VALUES('cmpbttcg6001uub6dcwk5fgm4','rider-1','Streak Bonus - 12 weeks',600,1778973574470);
INSERT INTO rewards VALUES('cmpbttcg7001wub6dvv07md0y','rider-1','Referral Bonus',500,1778282374470);
INSERT INTO rewards VALUES('cmpbttcg8001yub6de48y3ukl','rider-3','Streak Bonus - 8 weeks',400,1778714374470);
INSERT INTO rewards VALUES('cmpbttcga0020ub6dptxmsh4z','rider-3','Referral Bonus - Deepak joined',500,1777850374470);
INSERT INTO rewards VALUES('cmpbttcgc0022ub6d11nl1ib6','rider-6','Streak Bonus - 20 weeks',1000,1779059974470);
INSERT INTO rewards VALUES('cmpbttcgd0024ub6dtgoh3vdj','rider-6','Loyalty Champion',200,1778541574470);
CREATE TABLE IF NOT EXISTS "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO settings VALUES('cmpbttcgn002hub6dlttxpzsz','dailyRent','39900',1779146374488);
INSERT INTO settings VALUES('cmpbttcgp002iub6dcquzzsap','weeklyRent','219900',1779146374489);
INSERT INTO settings VALUES('cmpbttcgq002jub6dkritj1l3','monthlyRent','749900',1779146374491);
INSERT INTO settings VALUES('cmpbttcgt002kub6dg2k724ob','securityDeposit','500000',1779146374493);
INSERT INTO settings VALUES('cmpbttcgu002lub6ds9xskhny','lateFee','5000',1779146374495);
INSERT INTO settings VALUES('cmpbttcgw002mub6dqrt41b9w','referralBonus','50000',1779146374496);
INSERT INTO settings VALUES('cmpbttcgx002nub6do0a6zykv','autoApproveKYC','false',1779146374497);
INSERT INTO settings VALUES('cmpbttcgy002oub6dsi5d0r85','emailNotifications','true',1779146374498);
INSERT INTO settings VALUES('cmpbttcgz002pub6dafxmkb7m','smsNotifications','true',1779146374499);
INSERT INTO settings VALUES('cmpbttch0002qub6dmy6g7lw9','gracePeriodHours','24',1779146374501);
CREATE TABLE IF NOT EXISTS "legal_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO legal_documents VALUES('cmpbttch1002rub6dtagz23ro','terms','Terms of Service',unistr('# Terms of Service\u000a\u000a**Last Updated:** October 15, 2024\u000a\u000a## 1. Acceptance of Terms\u000a\u000aBy accessing or using the Voltium platform, you agree to be bound by these Terms.\u000a\u000a## 2. Vehicle Rental\u000a\u000a### 2.1 Eligibility\u000a- Must be at least 18 years old\u000a- Must hold a valid driving license\u000a- Must complete KYC verification\u000a\u000a## 3. Payments\u000a\u000a### 3.1 Security Deposit\u000a- ₹5,000 refundable security deposit\u000a- Refunded within 7 business days\u000a\u000a### 3.2 Late Fees\u000a- ₹50/hour after grace period'),1779146374502);
INSERT INTO legal_documents VALUES('cmpbttch3002sub6d9mw3axpu','privacy','Privacy Policy',unistr('# Privacy Policy\u000a\u000a## Information We Collect\u000a\u000a### Personal Information\u000a- Full name, email, phone number\u000a- Government ID details\u000a- Bank account details\u000a\u000a## Data Security\u000a- AES-256 encryption\u000a- Regular security audits'),1779146374504);
INSERT INTO legal_documents VALUES('cmpbttch4002tub6dkiamsqpq','refund','Refund Policy',unistr('# Refund Policy\u000a\u000a## Security Deposit\u000a- Processed within 7 business days\u000a- Deducted for damages or unpaid fees\u000a\u000a## Top-up Refunds\u000a- Unused wallet balance refundable\u000a- Processing: 5-7 business days'),1779146374504);
INSERT INTO legal_documents VALUES('cmpbttch5002uub6di6zydzza','lease','Lease Agreement',unistr('# Vehicle Lease Agreement\u000a\u000a## Parties\u000a- **Voltium Electric Mobility** (Lessor)\u000a- **Rider** (Lessee)\u000a\u000a## Terms\u000a- Security Deposit: ₹5,000\u000a- Maintenance handled by Lessor\u000a- 24-hour roadside assistance'),1779146374506);
CREATE TABLE IF NOT EXISTS "faqs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO faqs VALUES('faq-1','How do I request a battery swap?','Go to Support > Battery Issue. Our team will reach you within 30 minutes.','Vehicle',1,1,1779146374507,1779146374507);
INSERT INTO faqs VALUES('faq-2','What is the late fee policy?','₹50 per hour after grace period. Maximum 24 hours worth.','Payments',2,1,1779146374509,1779146374509);
INSERT INTO faqs VALUES('faq-3','How long do refunds take?','5-7 business days, credited to original payment method.','Payments',3,1,1779146374510,1779146374510);
INSERT INTO faqs VALUES('faq-4','What happens in case of vehicle damage?','Report immediately through the app. Minor scratches covered by deposit.','Vehicle',4,1,1779146374512,1779146374512);
INSERT INTO faqs VALUES('faq-5','How do I update KYC documents?','Profile > Edit Profile > KYC Documents. Verification takes 24-48 hours.','Account',5,1,1779146374513,1779146374513);
INSERT INTO faqs VALUES('faq-6','Can I switch plans mid-cycle?','Yes! Upgrade anytime. Remaining value prorated to new plan.','Plans',6,1,1779146374515,1779146374515);
INSERT INTO faqs VALUES('faq-7','What if my vehicle breaks down?','Call 1800-VOLT. Replacement vehicle within 2 hours. No charge for downtime.','Vehicle',7,1,1779146374516,1779146374516);
INSERT INTO faqs VALUES('faq-8','How does the referral program work?','Share your code. Both earn ₹500 when referred friend completes first rental.','Rewards',8,1,1779146374517,1779146374517);
CREATE TABLE IF NOT EXISTS "team_leaders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO team_leaders VALUES('tl-1','Amit Sharma','9876512345','amit.sharma@voltium.in',1,1779146374349,1779146374349);
INSERT INTO team_leaders VALUES('tl-2','Suresh Patel','9876567890','suresh.patel@voltium.in',1,1779146374351,1779146374351);
INSERT INTO team_leaders VALUES('tl-3','Rahul Kumar','9876511111','rahul.kumar@voltium.in',1,1779146374352,1779146374352);
INSERT INTO team_leaders VALUES('tl-4','Vikram Singh','9876522222','vikram.singh@voltium.in',0,1779146374353,1779146374353);
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'admin',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "UserContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserContact_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "UserCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCallLog_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "UserLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "accuracy" REAL,
    "speed" REAL,
    "isMocked" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLocation_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO UserLocation VALUES('cmpbtvatx007mubmkfed22kk4','cmpbtv4t4007iubmks8g64b6n',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779146465685);
INSERT INTO UserLocation VALUES('cmpbtxttw007oubmk44vu6nys','cmpbtv4t4007iubmks8g64b6n',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779146583620);
INSERT INTO UserLocation VALUES('cmpbu12mv007yubmkzr5zmfek','cmpbtv4t4007iubmks8g64b6n',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779146734999);
INSERT INTO UserLocation VALUES('cmpbu6g7h0087ubmkrhzvw9t1','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779146985869);
INSERT INTO UserLocation VALUES('cmpbuvjld0089ubmki1bzcjyt','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779148156656);
INSERT INTO UserLocation VALUES('cmpbuwt7q008bubmkzoso4zta','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779148215782);
INSERT INTO UserLocation VALUES('cmpbuxvfv008dubmkc6mxzf2d','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779148265323);
INSERT INTO UserLocation VALUES('cmpbuyind008fubmkhd6hhlem','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779148295402);
INSERT INTO UserLocation VALUES('cmpbv0itn008hubmk68c96vyr','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779148388940);
INSERT INTO UserLocation VALUES('cmpbv1nkg008mubmky3cy8i1w','cmpbv1kbb008iubmktv0q6q1z',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779148441745);
INSERT INTO UserLocation VALUES('cmpbvc83g008oubmkd1p2yynq','cmpbv1kbb008iubmktv0q6q1z',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779148934907);
INSERT INTO UserLocation VALUES('cmpbvklbt008qubmkac20j6jo','cmpbv1kbb008iubmktv0q6q1z',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779149325305);
INSERT INTO UserLocation VALUES('cmpbw8dxk008submk2eriomss','cmpbv1kbb008iubmktv0q6q1z',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779150435464);
INSERT INTO UserLocation VALUES('cmpc6s99d008wubmktc0cjkgf','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168158689);
INSERT INTO UserLocation VALUES('cmpc6tout008yubmkatru179y','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168225557);
INSERT INTO UserLocation VALUES('cmpc6uz1m0090ubmkta9gdsv9','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168285418);
INSERT INTO UserLocation VALUES('cmpc6w9o60092ubmkl0v9l908','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168345846);
INSERT INTO UserLocation VALUES('cmpc6xjpk0094ubmkfdnoror0','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168405512);
INSERT INTO UserLocation VALUES('cmpc6yu4f0096ubmkb33a9tjw','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168465664);
INSERT INTO UserLocation VALUES('cmpc704di0098ubmk3216siou','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168525606);
INSERT INTO UserLocation VALUES('cmpc71dyo009aubmkv6oblgzm','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168584688);
INSERT INTO UserLocation VALUES('cmpc72ocr009cubmk3n69zsin','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168644811);
INSERT INTO UserLocation VALUES('cmpc73yr9009eubmk3pm5q88p','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168704949);
INSERT INTO UserLocation VALUES('cmpc7591j009gubmkr6wllm65','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168764936);
INSERT INTO UserLocation VALUES('cmpc76jia009iubmk42umreeh','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168825151);
INSERT INTO UserLocation VALUES('cmpc77tpc009kubmk3x0i2cpx','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168885024);
INSERT INTO UserLocation VALUES('cmpc7945g009mubmko1z1elli','cmpbu6cch0081ubmkvb4893z2',37.4219982999999985,-122.0840000000000031,5.0,0.0,0,1779168945220);
CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "targetIds" TEXT NOT NULL DEFAULT '[]',
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "AnnouncementDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveredAt" DATETIME,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementDelivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementDelivery_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "riderId" TEXT,
    "vehicleId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "insuranceClaim" BOOLEAN NOT NULL DEFAULT false,
    "insuranceClaimNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Incident_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "RiderEarning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "platform" TEXT,
    "amount" REAL NOT NULL,
    "trips" INTEGER NOT NULL DEFAULT 0,
    "distance" REAL,
    "hoursOnline" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiderEarning_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "RiderScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "paymentScore" REAL NOT NULL DEFAULT 0,
    "kycScore" REAL NOT NULL DEFAULT 0,
    "activityScore" REAL NOT NULL DEFAULT 0,
    "supportScore" REAL NOT NULL DEFAULT 0,
    "compositeScore" REAL NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiderScore_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "TrafficFine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "fineId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "location" TEXT,
    "violationType" TEXT NOT NULL,
    "violationDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentProofUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrafficFine_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "DeviceViolation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riderId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "DeviceViolation_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
COMMIT;
