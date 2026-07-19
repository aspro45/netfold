import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  FileSignature,
  LockKeyhole,
  Orbit,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { deployment } from "@/lib/deployment";
import { shortAddress } from "@/lib/format";

const grossObligations = [
  { from: "A", to: "B", amount: "100" },
  { from: "B", to: "C", amount: "70" },
  { from: "C", to: "A", amount: "50" },
  { from: "C", to: "D", amount: "20" },
  { from: "D", to: "B", amount: "10" },
  { from: "B", to: "A", amount: "15" },
] as const;

const residualPayments = [
  { from: "A", to: "B", amount: "25" },
  { from: "A", to: "D", amount: "10" },
] as const;

const protocolSteps = [
  {
    number: "01",
    title: "Record",
    body: "Participants sign bilateral stablecoin obligations.",
    icon: FileSignature,
  },
  {
    number: "02",
    title: "Open",
    body: "Accepted obligations enter a shared settlement epoch.",
    icon: Orbit,
  },
  {
    number: "03",
    title: "Fold",
    body: "The ledger resolves every participant to one net position.",
    icon: Waypoints,
  },
  {
    number: "04",
    title: "Settle",
    body: "Debtors fund residuals and creditors claim on Arc.",
    icon: CircleDollarSign,
  },
] as const;

const contracts = [
  {
    label: "Registry",
    address: deployment.registry,
  },
  {
    label: "Obligation book",
    address: deployment.obligationBook,
  },
  {
    label: "Clearinghouse",
    address: deployment.clearinghouse,
  },
] as const;

export function ProtocolOverview() {
  return (
    <div className="protocol-overview">
      <section className="overview-intro">
        <div className="overview-copy">
          <p className="overview-kicker">
            <Waypoints size={15} aria-hidden="true" />
            Arc-native multilateral clearing
          </p>
          <h1>Stablecoin net settlement.</h1>
          <p className="overview-thesis">
            Settle the net, not every obligation.
          </p>
          <p className="overview-summary">
            NETFOLD groups signed obligations into a settlement epoch,
            calculates each participant&apos;s final position, and moves only
            the residual USDC or EURC balances on Arc.
          </p>

          <div className="overview-actions">
            <Link className="overview-primary-action" href="/clearing">
              Open clearing floor
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="overview-secondary-action" href="/docs">
              Read protocol docs
              <BookOpenText size={16} aria-hidden="true" />
            </Link>
          </div>

          <dl className="overview-metrics" aria-label="Reference epoch metrics">
            <div>
              <dt>Gross obligations</dt>
              <dd>265.00 USDC</dd>
            </div>
            <div>
              <dt>Net settlement</dt>
              <dd>35.00 USDC</dd>
            </div>
            <div>
              <dt>Liquidity saved</dt>
              <dd>86.8%</dd>
            </div>
          </dl>
        </div>

        <div className="netting-visual" aria-label="How NETFOLD reduces payments">
          <header className="netting-visual-header">
            <div>
              <span>Reference epoch / 001</span>
              <strong>Six obligations become two payments</strong>
            </div>
            <span className="testnet-status">
              <CheckCircle2 size={13} aria-hidden="true" />
              Arc Testnet
            </span>
          </header>

          <div className="netting-comparison">
            <section className="gross-stack" aria-label="Gross obligations">
              <div className="stack-heading">
                <span>Before</span>
                <strong>265 USDC gross</strong>
              </div>
              <div className="obligation-list">
                {grossObligations.map((obligation) => (
                  <div
                    className="obligation-row"
                    key={`${obligation.from}-${obligation.to}-${obligation.amount}`}
                  >
                    <span className="route-participants">
                      <b>{obligation.from}</b>
                      <ArrowRight size={12} aria-hidden="true" />
                      <b>{obligation.to}</b>
                    </span>
                    <strong>{obligation.amount}</strong>
                  </div>
                ))}
              </div>
            </section>

            <div className="fold-engine" aria-label="NETFOLD calculation">
              <span>Fold</span>
              <Waypoints size={23} aria-hidden="true" />
              <ArrowRight size={16} aria-hidden="true" />
            </div>

            <section className="residual-stack" aria-label="Residual payments">
              <div className="stack-heading">
                <span>After</span>
                <strong>35 USDC residual</strong>
              </div>
              <div className="residual-list">
                {residualPayments.map((payment) => (
                  <div
                    className="residual-row"
                    key={`${payment.from}-${payment.to}-${payment.amount}`}
                  >
                    <span className="route-participants">
                      <b>{payment.from}</b>
                      <ArrowRight size={12} aria-hidden="true" />
                      <b>{payment.to}</b>
                    </span>
                    <strong>{payment.amount}</strong>
                  </div>
                ))}
              </div>
              <p>
                C resolves to zero. B and D receive only their final credits.
              </p>
            </section>
          </div>

          <footer className="netting-result">
            <span>230 USDC does not need to move</span>
            <strong>86.8% less settlement liquidity</strong>
          </footer>
        </div>
      </section>

      <section className="overview-process" aria-labelledby="process-title">
        <div className="overview-section-heading">
          <p>How the protocol works</p>
          <h2 id="process-title">
            Many obligations in. One balanced settlement out.
          </h2>
        </div>
        <div className="protocol-step-row">
          {protocolSteps.map(({ number, title, body, icon: Icon }) => (
            <article key={number}>
              <div className="step-index">
                <span>{number}</span>
                <Icon size={18} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overview-arc" aria-labelledby="arc-title">
        <div className="arc-rationale">
          <p>Why Arc</p>
          <h2 id="arc-title">Settlement infrastructure, not another wallet.</h2>
          <p>
            Arc provides the stablecoin-native execution layer. NETFOLD keeps
            obligation history, canonical positions, funding, and claims
            inspectable onchain.
          </p>
          <div className="arc-properties">
            <span>
              <ShieldCheck size={15} aria-hidden="true" />
              EIP-712 signed obligations
            </span>
            <span>
              <LockKeyhole size={15} aria-hidden="true" />
              Locked epoch positions
            </span>
            <span>
              <CircleDollarSign size={15} aria-hidden="true" />
              Native USDC and EURC
            </span>
          </div>
        </div>

        <div className="overview-contracts">
          <div className="contracts-heading">
            <span>Live deployment</span>
            <strong>Arc Testnet / 5042002</strong>
          </div>
          {contracts.map(({ label, address }) => (
            <a
              href={
                address
                  ? `https://testnet.arcscan.app/address/${address}`
                  : "https://testnet.arcscan.app"
              }
              target="_blank"
              rel="noreferrer"
              key={label}
            >
              <span>{label}</span>
              <code>{address ? shortAddress(address) : "Not configured"}</code>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
