# Player Dashboard & Ledger Architecture

This document outlines the visual and technical flow for moving the Poker Championship app to a self-serve, asynchronous **Ledger System** with forced logins.

## 1. The Async Session Lifecycle

```mermaid
sequenceDiagram
    actor Admin
    actor Player
    participant System

    Note over Admin, System: The Day Begins
    Admin->>System: Clicks "Start Day"
    System-->>Admin: Live Session Created

    Note over Player, System: Asynchronous Arrivals
    Player->>System: Opens App (Hits Forced Login Gate)
    Player->>System: Enters PIN
    System-->>Player: Grants Access to Personal Dashboard
    
    Player->>System: Declares Initial Buy-In
    System-->>Player: Dashboard Locks into "Active Play" State

    Note over Player, System: Mid-Game Actions
    alt Player needs more chips
        Player->>System: Clicks "Rebuy" & Enters Amount
        System-->>System: Total Buy-In Updated
    end

    Note over Player, System: The Night Ends
    Player->>System: Declares Final Cash-Out & Leaves
    Admin->>System: Clicks "End Day" / "Audit"
    
    Note over Admin, System: The Audit Phase
    System-->>Admin: Shows Ledger (Total Buy-Ins vs Total Cash-Outs)
    alt Player forgot to Cash-Out
        Admin->>System: Overrides/Inputs missing Cash-Out manually
    end
    
    Admin->>System: Hits "Approve & Commit"
    System-->>System: Calculates (Cash Out - Buy In) & Updates Net Worth permanently
```

## 2. Personal Dashboard Wireframe Concept

```mermaid
block-beta
    columns 1
    space
    Title["🏆 Championship - Welcome, Player"]
    space
    
    block:Hero
        columns 1
        Label["Chips you must pull from the case"]
        Amount((" 1,500 "))
        Details["(Start Balance: 1000 | Banked Profit: 500)"]
    end
    space

    block:Actions
        columns 2
        BuyIn["➕ Declare Buy-In"]
        CashOut["💰 Declare Cash Out"]
    end
    space

    block:Loans
        columns 2
        Owed["Owed to You: 200"]
        Owe["You Owe: 50"]
    end
```

## 3. Potential Pitfalls & Solutions

To ensure the system doesn't break down when it hits the real world, we've designed fail-safes for the most common human errors:

| Pitfall | Solution |
| :--- | :--- |
| **Players bypassing the math** | A **Forced Login Gate** ensures they cannot access the game without checking their dashboard first. |
| **Player forgets to Cash-Out** | The Admin acts as the ultimate auditor and can **manually override** or fill in missing cash-outs during the End Day review. |
| **Player needs a Rebuy** | The Dashboard will feature a dedicated **"Add Chips"** button that lets them safely add to their Daily Buy-In mid-game. |
