# Usability test script

See also `HCI_SIGN_OFF_TEMPLATE.md` for signature tables.

Status: **HUMAN_APPROVAL_REQUIRED**

## Environment

- UAT only (never production destructive tests)
- Real role accounts
- Desktop, tablet, and production-floor phone
- Optional slow 3G throttle

## Script by role

### FG_OPERATOR

1. Login  
2. Complete forced password change if shown  
3. Create record → save → submit  
4. Confirm evidence upload feedback  

### FG_SUPERVISOR

1. Open To Check  
2. Check or reject with reason  
3. Confirm queue updates  

### QA_EXECUTIVE

1. Open To Verify  
2. Verify or reject with evidence review  
3. Open corrective action if prompted  

### FOOD_SAFETY_TEAM_LEADER

1. Review Home oversight cards  
2. Open Reports  
3. Escalate one item if available  

### AUDITOR

1. Navigate reports read-only  
2. Confirm no write controls  

### SYSTEM_ADMINISTRATOR

1. Users admin smoke  
2. Template preview: banner, filters, reset confirm, viewport switch  

## Pass criteria

- No redirect loop on password gate  
- No inaccessible primary actions  
- Errors recoverable with preserved data where applicable  
- Keyboard path works for login and password change  

Formal acceptance requires signed HCI_SIGN_OFF_TEMPLATE.
