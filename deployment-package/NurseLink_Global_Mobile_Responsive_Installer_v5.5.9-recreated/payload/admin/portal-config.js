window.NurseLinkPortalConfig = Object.freeze({
  version: '5.5.2',
  entryPoints: Object.freeze({
    memberLogin: '/login',
    memberPortal: '/dashboard',
    adminLogin: '/admin/login.html',
    adminPortal: '/admin/'
  }),
  adminTabs: Object.freeze([
    ['dashboard', 'Dashboard'],
    ['members', 'Members'],
    ['applications', 'Applications'],
    ['verification', 'Verification'],
    ['organizations', 'Organizations'],
    ['programs', 'Programs'],
    ['employment', 'Employment & Opportunities'],
    ['training', 'Training & Events'],
    ['communications', 'Communications'],
    ['reports', 'Reports & Analytics'],
    ['support', 'Support Cases'],
    ['audit', 'Audit Logs'],
    ['health', 'System Health'],
    ['settings', 'Settings']
  ]),
  compatibilityRedirects: Object.freeze({
    '/nurselink-membership-command-center.html': '/admin/#applications',
    '/nurselink-membership-administration.html': '/admin/#applications',
    '/nurselink-membership-onboarding-admin.html': '/admin/#members',
    '/nurselink-member-registry.html': '/admin/#members',
    '/nurselink-membership-welcome.html': '/dashboard#membership'
  }),
  managedModules: Object.freeze({
    verification: Object.freeze([
      ['/nurselink-credential-compliance.html', 'Credential Compliance']
    ]),
    programs: Object.freeze([
      ['/nurselink-chapter-management.html', 'Chapters & Communities'],
      ['/nurselink-benefit-management.html', 'Benefits & Resources'],
      ['/nurselink-engagement-command-center.html', 'Engagement'],
      ['/nurselink-enterprise-command-center.html', 'Enterprise Programs'],
      ['/nurselink-enterprise-goals-admin.html', 'Enterprise Goals'],
      ['/nurselink-enterprise-enrollment-admin.html', 'Enterprise Enrollment'],
      ['/nurselink-enterprise-outcomes-admin.html', 'Enterprise Outcomes'],
      ['/nurselink-enterprise-support-admin.html', 'Enterprise Support']
    ]),
    training: Object.freeze([
      ['/nurselink-event-management.html', 'Event Management']
    ]),
    reports: Object.freeze([
      ['/nurselink-institutional-analytics.html', 'Institutional Analytics']
    ]),
    health: Object.freeze([
      ['/nurselink-operations-center.html', 'Operations Center'],
      ['/nurselink-production-readiness.html', 'Production Readiness'],
      ['/nurselink-super-admin-test-center.html', 'Super Admin Test Center']
    ])
  })
});
