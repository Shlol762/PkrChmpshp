import React from 'react';
import { HelpCircle, AlertCircle, Sparkles, RefreshCw, Layers } from 'lucide-react';

function Card({ rank, suit }) {
  const isRed = suit === '♥' || suit === '♦';
  return (
    <div className={`flex flex-col items-center justify-between w-9 h-12 sm:w-10 sm:h-14 py-1 rounded-lg bg-zinc-800 border border-white/10 font-mono font-bold text-xs sm:text-sm select-none shadow-md ${isRed ? 'text-rose-500' : 'text-zinc-100'}`}>
      <span className="leading-none pt-0.5">{rank}</span>
      <span className="text-sm sm:text-base leading-none pb-0.5">{suit}</span>
    </div>
  );
}

export default function RulesTab() {
  const hands = [
    {
      rank: 1,
      name: "Royal Flush",
      tag: "Strongest",
      description: "Ace, King, Queen, Jack, and Ten of the same suit.",
      cards: [
        { rank: 'A', suit: '♠' },
        { rank: 'K', suit: '♠' },
        { rank: 'Q', suit: '♠' },
        { rank: 'J', suit: '♠' },
        { rank: '10', suit: '♠' }
      ],
      tieBreaker: "Unbeatable. If two players have one (only possible in wild card games or split on board), the pot is split."
    },
    {
      rank: 2,
      name: "Straight Flush",
      tag: "Rare",
      description: "Five consecutive cards of the same suit.",
      cards: [
        { rank: '9', suit: '♥' },
        { rank: '8', suit: '♥' },
        { rank: '7', suit: '♥' },
        { rank: '6', suit: '♥' },
        { rank: '5', suit: '♥' }
      ],
      tieBreaker: "Highest card at the top of the straight wins. For example, a Jack-high straight flush beats a 9-high straight flush."
    },
    {
      rank: 3,
      name: "Four of a Kind",
      tag: "Quads",
      description: "Four cards of the exact same rank.",
      cards: [
        { rank: 'K', suit: '♣' },
        { rank: 'K', suit: '♦' },
        { rank: 'K', suit: '♥' },
        { rank: 'K', suit: '♠' },
        { rank: '5', suit: '♣' }
      ],
      tieBreaker: "Highest rank quads win. If four of a kind is on the board, the player with the highest fifth card (kicker) wins."
    },
    {
      rank: 4,
      name: "Full House",
      tag: "Boat",
      description: "Three cards of one rank, and two cards of another rank.",
      cards: [
        { rank: 'Q', suit: '♣' },
        { rank: 'Q', suit: '♦' },
        { rank: 'Q', suit: '♥' },
        { rank: '10', suit: '♠' },
        { rank: '10', suit: '♦' }
      ],
      tieBreaker: "Highest three-of-a-kind wins. If they are identical (e.g. on the board), the highest pair wins. E.g., Q-Q-Q-10-10 beats Q-Q-Q-8-8."
    },
    {
      rank: 5,
      name: "Flush",
      tag: "Same Suit",
      description: "Five cards of the same suit, not in numerical order.",
      cards: [
        { rank: 'A', suit: '♦' },
        { rank: 'J', suit: '♦' },
        { rank: '8', suit: '♦' },
        { rank: '6', suit: '♦' },
        { rank: '2', suit: '♦' }
      ],
      tieBreaker: "The player with the highest single card in their flush wins. If they tie on the highest, the 2nd, 3rd, 4th, and 5th cards are compared in order."
    },
    {
      rank: 6,
      name: "Straight",
      tag: "Run",
      description: "Five consecutive cards of mixed suits.",
      cards: [
        { rank: '8', suit: '♠' },
        { rank: '7', suit: '♥' },
        { rank: '6', suit: '♦' },
        { rank: '5', suit: '♣' },
        { rank: '4', suit: '♠' }
      ],
      tieBreaker: "Highest card at the top of the run wins. Note: Ace can act as high (A-K-Q-J-10) or low (5-4-3-2-A, known as a 'wheel')."
    },
    {
      rank: 7,
      name: "Three of a Kind",
      tag: "Trips / Set",
      description: "Three cards of the same rank, plus two unrelated cards.",
      cards: [
        { rank: 'J', suit: '♣' },
        { rank: 'J', suit: '♦' },
        { rank: 'J', suit: '♥' },
        { rank: 'A', suit: '♠' },
        { rank: '9', suit: '♥' }
      ],
      tieBreaker: "Highest three-of-a-kind wins. If identical (on the board), the highest kicker wins, followed by the second highest kicker."
    },
    {
      rank: 8,
      name: "Two Pair",
      tag: "Double Pair",
      description: "Two cards of one rank, two cards of another, plus a kicker.",
      cards: [
        { rank: '10', suit: '♣' },
        { rank: '10', suit: '♦' },
        { rank: '7', suit: '♥' },
        { rank: '7', suit: '♠' },
        { rank: 'A', suit: '♣' }
      ],
      tieBreaker: "Highest pair wins. If players have the same high pair, the second pair determines the winner. If both pairs match, the 5th card (kicker) wins."
    },
    {
      rank: 9,
      name: "One Pair",
      tag: "Pair",
      description: "Two cards of the same rank, plus three kickers.",
      cards: [
        { rank: 'A', suit: '♣' },
        { rank: 'A', suit: '♦' },
        { rank: 'K', suit: '♠' },
        { rank: '10', suit: '♥' },
        { rank: '4', suit: '♦' }
      ],
      tieBreaker: "Highest pair wins. If players share the same pair, the highest kicker wins. If that matches, it goes to the 2nd and then 3rd kicker."
    },
    {
      rank: 10,
      name: "High Card",
      tag: "No Pair",
      description: "Five unmatched cards. Valued solely by individual ranks.",
      cards: [
        { rank: 'K', suit: '♣' },
        { rank: 'Q', suit: '♦' },
        { rank: '8', suit: '♠' },
        { rank: '4', suit: '♥' },
        { rank: '2', suit: '♣' }
      ],
      tieBreaker: "Highest card wins. If they tie on the highest card, the next highest card determines the winner, and so on."
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white">Rules & Hands Guide</h2>
        <p className="text-sm text-zinc-500">Official Texas Hold'em hand rankings and tie-breaker rules.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Hands Hierarchy List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <Layers className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">Hand Rankings (Strongest to Weakest)</h3>
          </div>

          <div className="space-y-3">
            {hands.map((hand) => (
              <div
                key={hand.rank}
                className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 hover:border-white/10 hover:bg-zinc-900/60"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center text-[10px] font-bold bg-zinc-800 text-zinc-400 w-5 h-5 rounded-full">
                      {hand.rank}
                    </span>
                    <h4 className="text-base font-bold text-white">{hand.name}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      hand.rank <= 2 ? 'bg-amber-500/10 text-amber-400' :
                      hand.rank <= 5 ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {hand.tag}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400">{hand.description}</p>
                  <p className="text-[11px] text-zinc-500 italic bg-zinc-950/40 p-2 rounded-lg border border-white/5 mt-2">
                    <span className="font-semibold text-zinc-400">Tie-Breaker:</span> {hand.tieBreaker}
                  </p>
                </div>

                {/* Hand Example Cards */}
                <div className="flex items-center gap-1.5 self-start md:self-center shrink-0">
                  {hand.cards.map((c, i) => (
                    <Card key={i} rank={c.rank} suit={c.suit} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rules and FAQ Sidebar */}
        <div className="space-y-6">
          {/* Rule Card 1 */}
          <div className="bg-gradient-to-b from-zinc-900/60 to-zinc-900/20 border border-white/5 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Sparkles className="h-5 w-5" />
              <h4 className="font-bold text-white text-sm uppercase tracking-wider">The Best 5 Rule</h4>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              In Texas Hold'em, players construct their hands using exactly <strong>five cards</strong> from any combination of their <strong>two hole cards</strong> and the <strong>five community cards</strong>.
            </p>
            <div className="bg-zinc-950/60 p-3 rounded-xl border border-white/5 text-xs text-zinc-500">
              Any remaining 6th or 7th cards are completely ignored. Suit strengths are never used to break a tie.
            </div>
          </div>

          {/* Rule Card 2 */}
          <div className="bg-gradient-to-b from-zinc-900/60 to-zinc-900/20 border border-white/5 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-blue-400">
              <RefreshCw className="h-5 w-5" />
              <h4 className="font-bold text-white text-sm uppercase tracking-wider">Kickers & Splits</h4>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              If two or more players make the same hand (like a Pair of Kings or Three Queens), the winner is determined by the remaining cards, called <strong>kickers</strong>.
            </p>
            <div className="space-y-2.5 text-xs text-zinc-400 border-t border-white/5 pt-3">
              <div className="flex gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span>If a player has a kicker with a higher value, they win the entire pot.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span>If all 5 cards in the best combinations are identical in rank, the hand is a tie, and the pot is <strong>split equally</strong> (a Split Pot).</span>
              </div>
            </div>
          </div>

          {/* FAQ Card */}
          <div className="bg-gradient-to-b from-zinc-900/60 to-zinc-900/20 border border-white/5 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <HelpCircle className="h-5 w-5" />
              <h4 className="font-bold text-white text-sm uppercase tracking-wider">Common Scenarios</h4>
            </div>
            <div className="space-y-4 text-xs text-zinc-400">
              <div>
                <span className="font-bold text-zinc-200 block mb-1">Two Pair vs Two Pair</span>
                <span>Compare the highest pair first. If identical, compare the second pair. If still identical, compare the 5th card (kicker).</span>
              </div>
              <div>
                <span className="font-bold text-zinc-200 block mb-1">What is "Playing the Board"?</span>
                <span>If the best possible 5-card hand is already on the board (e.g., a Royal Flush on the board), all active players split the pot.</span>
              </div>
              <div>
                <span className="font-bold text-zinc-200 block mb-1">Is A-2-3-4-5 a Straight?</span>
                <span>Yes. The Ace acts as a 1 (low) to make the lowest possible straight. This beats high card, but loses to any higher straight.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
