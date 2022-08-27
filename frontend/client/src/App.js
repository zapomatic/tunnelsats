import {
  Row,
  Col,
  Container,
  Button,
  Nav,
  Navbar,
  Collapse,
  Form,
  InputGroup,
} from "react-bootstrap";
import io from "socket.io-client";
import { useState, useEffect } from "react";
//import KeyInput from './components/KeyInput';
import RuntimeSelector from "./components/RuntimeSelector";
import InvoiceModal from "./components/InvoiceModal";
import { getTimeStamp } from "./timefunction.js";
import HeaderInfo from "./components/HeaderInfo";
import logo from "./media/tunnelsats_headerlogo3.png";
import WorldMap from "./components/WorldMap";
import { IoIosRefresh } from "react-icons/io";
import "./wireguard.js";

// helper
const getDate = (timestamp) =>
  (timestamp !== undefined ? new Date(timestamp) : new Date()).toISOString();
const base64regex =
  /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

// Env Variables to have the same code base main and dev
const REACT_APP_THREE_MONTHS = process.env.REACT_APP_THREE_MONTHS || 0.002;
const REACT_APP_LNBITS_URL = process.env.REACT_APP_LNBITS_URL || "";
const REACT_APP_SOCKETIO = process.env.REACT_APP_SOCKETIO || "/";

const DEBUG = false;

// WebSocket
var socket = io.connect(REACT_APP_SOCKETIO);

// Consts
var emailAddress;
var clientPaymentHash;
var isPaid = false;
var keyID;

function App() {
  const [keyPair, displayNewPair] = useState(
   window.wireguard.generateKeypair()
  );
  const [priceDollar, updatePrice] = useState(REACT_APP_THREE_MONTHS);
  const [satsPerDollar, setSatsPerDollar] = useState(
    Math.round(100000000 / 20000)
  );
  const [showSpinner, setSpinner] = useState(true);
  const [payment_request, setPaymentrequest] = useState(0);
  const [showPaymentSuccessfull, setPaymentAlert] = useState(false);
  //Modal Invoice
  const [visibleInvoiceModal, setShowInvoiceModal] = useState(false);
  const closeInvoiceModal = () => setShowInvoiceModal(false);
  const showInvoiceModal = () => setShowInvoiceModal(true);
  //Modal Configdata
  const [isConfigModal, showConfigModal] = useState(false);
  const renderConfigModal = () => showConfigModal(true);
  const hideConfigModal = () => showConfigModal(false);
  //LoginModal
  //const [isLoginModal, showLoginModal] = useState(false);
  //const renderLoginModal = () => showLoginModal(true);
  //const hideLoginModal = () => showLoginModal(false);

  // switch first <-> renew subscription
  const [isRenewSub, setRenewSub] = useState(false);
  const showRenew = () => setRenewSub(true);
  const hideRenew = () => setRenewSub(false);

  const [server, setServer] = useState(country);
  const [pubkey, setPubkey] = useState("");
  const [valid, setValid] = useState(false);
  const [timeValid, setTimeValid] = useState(false);
  const [timeSubscription, setTime] = useState("");
  const [newTimeSubscription, setNewTime] = useState("");

  // World Map
  const [country, updateCountry] = useState("eu");

  /* WorldMap Continent Codes
    AF = Africa
    NA = North America (US+CAD)
    SA = South America (LatAm)
    EU = Europe
    AS = Asia
    OC = Oceania (AUS+NZ)
  */

  //Successful payment alert
  const renderAlert = (show) => {
    setPaymentAlert(show);
    setTimeout(() => setPaymentAlert(false), [2000]);
  };

  //Updates the QR-Code
  const updatePaymentrequest = () => {
    socket.on("lnbitsInvoice", (invoiceData) => {
      DEBUG && console.log(`${getDate()} App.js: got msg lnbitsInvoice`);
      DEBUG &&
        console.log(
          `${getDate()} Paymenthash: ${invoiceData.payment_hash}, ${
            invoiceData.payment_request
          }`
        );
      setPaymentrequest(invoiceData.payment_request);
      clientPaymentHash = invoiceData.payment_hash;
      setSpinner(false);
    });
  };

  //Connect to WebSocket Server
  socket.removeAllListeners("connect").on("connect", () => {
    DEBUG && console.log(`${getDate()} App.js: connect with id: ${socket.id}`);
    //Checks for already paid invoice if browser switche tab on mobile
    if (clientPaymentHash !== undefined) {
      checkInvoice();
    }
    // refresh pricePerDollar on start
    getPrice();
  });

  useEffect(() => {
    setNewTime("");
    setTime("");
    setTimeValid(false);
    socket.emit("getServer", country);
  }, [country]);

  // get current btc per dollar
  const getPrice = () => {
    socket.removeAllListeners("getPrice").emit("getPrice");
  };
  socket.off("receivePrice").on("receivePrice", (price) => {
    DEBUG && console.log(`${getDate()} App.js: server.getPrice(): ${price}`);
    setSatsPerDollar(Math.trunc(Math.round(price)));
  });

  // check invoice
  const checkInvoice = () => {
    DEBUG &&
      console.log(`${getDate()} App.js: checkInvoice(): ${clientPaymentHash}`);
    socket.emit("checkInvoice", clientPaymentHash);
  };

  //Get the invoice
  const getInvoice = (price, publicKey, presharedKey, priceDollar, country) => {
    DEBUG && console.log(`${getDate()} App.js: getInvoice(price): ${price}$`);
    socket.emit(
      "getInvoice",
      price,
      publicKey,
      presharedKey,
      priceDollar,
      country
    );
  };

  socket.off("invoicePaid").on("invoicePaid", (paymentHash) => {
    DEBUG &&
      console.log(
        `${getDate()} App.js: got msg 'invoicePaid': ${paymentHash}, clientPaymentHash: ${clientPaymentHash}`
      );

    if (paymentHash === clientPaymentHash && !isPaid) {
      renderAlert(true);
      isPaid = true;
      setSpinner(true);
    }
  });

  //Get wireguard config from Server
  socket.off("receiveConfigData").on("receiveConfigData", (wireguardConfig) => {
    DEBUG && console.log(`${getDate()} App.js: got msg receiveConfigData`);
    setSpinner(false);
    setPaymentrequest(buildConfigFile(wireguardConfig).join("\n"));
  });

  //Construct the Config File
  const buildConfigFile = (serverResponse) => {
    showInvoiceModal();
    renderConfigModal();
    const configArray = [
      "[Interface]",
      "PrivateKey = " + keyPair.privateKey,
      "Address = " + serverResponse.ipv4Address,
      // 'DNS = '+serverResponse.dns,
      "#VPNPort = " + serverResponse.portFwd,
      "#ValidUntil (UTC time)= " + getTimeStamp(priceDollar).toISOString(),
      " ",
      "[Peer]",
      "PublicKey = " + serverResponse.publicKey,
      "PresharedKey = " + keyPair.presharedKey,
      "Endpoint = " + serverResponse.dnsName + ":" + serverResponse.listenPort,
      "AllowedIPs = " + serverResponse.allowedIPs,
    ];
    return configArray;
  };

  //Change Runtime
  const runtimeSelect = (e) => {
    if (!isNaN(e.target.value)) {
      updatePrice(e.target.value);
    }
  };

  const download = (filename, text) => {
    const textArray = [text];
    const element = document.createElement("a");
    const file = new Blob(textArray, {
      endings: "native",
    });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
  };

  const sendEmail = (email, config, date) => {
    DEBUG &&
      console.log(
        `${getDate()} App.js: sendEmail(): ${email}, validdate: ${date}`
      );
    socket.emit("sendEmail", email, config, date);
  };

  const handleKeyLookUp = (event) => {
    event.preventDefault();
    // alert('You have submitted the form.')
    console.log("checkKeyDB emitted", server, pubkey);
    socket.emit("checkKeyDB", { serverURL: server, publicKey: pubkey });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // alert('You have submitted the form.')
    // console.log("Submit Worked", server, pubkey);
  };

  const handleChangeServer = (event) => {
    setServer({ server: event.target.value });
    setNewTime("");
    setTime("");
    setTimeValid(false);
  };

  const handleChangePubkey = (event) => {
    if (
      base64regex.test(event.target.value) &&
      event.target.value.length === 44
    ) {
      setPubkey(event.target.value);
      setValid(true);
      setNewTime("");
      setTime("");
    } else {
      setPubkey(event.target.value);
      setValid(false);
    }
  };

  return (
    <div>
      <Container>
        {/* Navigation Bar */}
        <Navbar variant="dark" expanded="true">
          <Container>
            <Navbar.Brand
              href="#"
              onClick={() => {
                hideRenew();
              }}
            >
              Tunnel⚡️Sats
            </Navbar.Brand>
            <Nav className="me-auto">
              { !isRenewSub ? (
              <Nav.Link
                href="#"
                onClick={() => {
                  showRenew();
                }}
              >
                Renew Subscription
              </Nav.Link>
              ) : (
                <Nav.Link
                href="#"
                onClick={() => {
                  hideRenew();
                }}
              >
                Get Subscription
              </Nav.Link>               
              )}
              <Nav.Link
                href="https://blckbx.github.io/tunnelsats"
                target="_blank"
                rel="noreferrer"
              >
                Guide
              </Nav.Link>
              <Nav.Link
                href="https://blckbx.github.io/tunnelsats/FAQ.html"
                target="_blank"
                rel="noreferrer"
              >
                FAQ
              </Nav.Link>
            </Nav>
            {/*}
            <Nav>
              <Button onClick={() => renderLoginModal()} variant="outline-info">Login</Button>
              <LoginModal show={isLoginModal} handleClose={hideLoginModal} />
            </Nav>
            */}
          </Container>
        </Navbar>
      </Container>

      <Container className="main-middle">
        <Row>
          <Col>
            {/* Logo */}
            <img src={logo} alt="" />

            {/* Intro Text */}
            <HeaderInfo />

            {/* WorldMap */}
            <WorldMap selected={country} onSelect={updateCountry} />

            { isRenewSub ? (
              <Form onSubmit={(e) => handleSubmit(e)}>
                {" "}
                {/* Renew Subscription */}
                <Form.Group className="updateSubFrom">
                  <InputGroup>
                    <InputGroup.Text>Selected Server</InputGroup.Text>
                    <Form.Control
                      disabled
                      value={server}
                      placeholder="Tunnelsats Server"
                      onChange={handleChangeServer}
                      type="text"
                    />
                  </InputGroup>
                  <InputGroup>
                    <InputGroup.Text>WG Pubkey</InputGroup.Text>
                    <Form.Control
                      enabled
                      value={pubkey}
                      placeholder="Wireguard Pubkey (base64 encoded)"
                      isValid={valid}
                      onChange={handleChangePubkey}
                    />
                  </InputGroup>
                  <Collapse in={valid}>
                    <div id="example-collapse-text">
                      {
                        <div>
                          <InputGroup>
                            <InputGroup.Text>Valid Until:</InputGroup.Text>
                            <Form.Control
                              disabled
                              value={timeSubscription}
                              isValid={timeValid}
                              // onChange = { handleChangePubkey}
                            />
                          </InputGroup>
                        </div>
                      }
                    </div>
                  </Collapse>

                  <Collapse in={valid}>
                    <div id="example-collapse-text">
                      {
                        <div>
                          <InputGroup>
                            <InputGroup.Text>NEW Valid Until:</InputGroup.Text>
                            <Form.Control
                              disabled
                              value={newTimeSubscription}
                              isValid={timeValid}
                              // onChange = { handleChangePubkey}
                            />
                          </InputGroup>
                        </div>
                      }
                    </div>
                  </Collapse>
                </Form.Group>
                <div className="main-buttons">
                  <Button
                    variant="secondary"
                    onClick={handleKeyLookUp}
                    type="submit"
                    disabled={!valid}
                  >
                    Query Key Info
                  </Button>
                </div>
                <Collapse in={true}>
                  <div id="example-collapse-text">
                    {
                      <div>
                        <RuntimeSelector onClick={runtimeSelect} />
                        <div className="price">
                          <h3>
                            {Math.trunc(
                              Math.round(priceDollar * satsPerDollar)
                            ).toLocaleString()}{" "}
                            <i class="fak fa-satoshisymbol-solidtilt" />
                          </h3>
                        </div>
                      </div>
                    }
                  </div>
                </Collapse>
                <div className="main-buttons">
                  <Button
                    variant="outline-warning"
                    onClick={() => {
                      getInvoice(
                        priceDollar * satsPerDollar,
                        pubkey,
                        keyID,
                        country,
                        priceDollar
                      );
                      showInvoiceModal();
                      updatePaymentrequest();
                      setSpinner(true);
                      isPaid = false;
                    }}
                    type="submit"
                    disabled={!timeValid}
                  >
                    Update Subscription
                  </Button>
                </div>
              </Form>
            ) : (
              <><Form>{/* else default: WG keys for new subscription */}
                  <Form.Group className="mb-2">
                    <InputGroup>
                      <InputGroup.Text>Private Key</InputGroup.Text>
                      <Form.Control
                        disabled
                        key={keyPair.privateKey}
                        defaultValue={keyPair.privateKey}
                        onChange={(event) => {
                          keyPair.privateKey = event.target.value;
                        } } />
                      <Button
                        onClick={() => {
                          displayNewPair(window.wireguard.generateKeypair);
                        } }
                        variant="secondary"
                      >
                        <IoIosRefresh
                          color="white"
                          size={20}
                          title="renew keys" />
                      </Button>
                    </InputGroup>
                    <InputGroup>
                      <InputGroup.Text>Public Key</InputGroup.Text>
                      <Form.Control
                        disabled
                        key={keyPair.publicKey}
                        defaultValue={keyPair.publicKey}
                        onChange={(event) => {
                          keyPair.publicKey = event.target.value;
                        } } />
                    </InputGroup>
                    <InputGroup>
                      <InputGroup.Text>Preshared Key</InputGroup.Text>
                      <Form.Control
                        disabled
                        key={keyPair.presharedKey}
                        defaultValue={keyPair.presharedKey}
                        onChange={(event) => {
                          keyPair.presharedKey = event.target.value;
                        } } />
                    </InputGroup>
                  </Form.Group>
                </Form>
                {<div>
                  <RuntimeSelector onClick={runtimeSelect} />
                    <div className="price">
                      <h3>
                        {Math.trunc(
                          Math.round(priceDollar * satsPerDollar)
                          ).toLocaleString()}{" "}
                          <i class="fak fa-satoshisymbol-solidtilt" />
                      </h3>
                    </div>
                </div>}

              {/* Button Generate Invoice */}
              <div className="main-buttons">
                <Button
                  onClick={() => {
                    getInvoice(
                      priceDollar * satsPerDollar,
                      keyPair.publicKey,
                      keyPair.presharedKey,
                      priceDollar,
                      country
                    );
                    showInvoiceModal();
                    hideConfigModal();
                    updatePaymentrequest();
                    setSpinner(true);
                    isPaid = false;
                  }}
                  variant="outline-warning"
                >
                  Generate Invoice
                </Button>
              </div>
              </>
            )}

            {/* Open InvoiceModal */}
            <InvoiceModal
              show={visibleInvoiceModal}
              showSpinner={showSpinner}
              isConfigModal={isConfigModal}
              value={payment_request}
              download={() => {
                download("tunnelsatsv2.conf", payment_request);
              }}
              showNewInvoice={() => {
                getInvoice(
                  priceDollar * satsPerDollar,
                  keyPair.publicKey,
                  keyPair.presharedKey,
                  priceDollar,
                  country
                );
                setSpinner(true);
              }}
              handleClose={closeInvoiceModal}
              emailAddress={emailAddress}
              expiryDate={getTimeStamp(priceDollar)}
              sendEmail={(data) =>
                sendEmail(data, payment_request, getTimeStamp(priceDollar))
              }
              showPaymentAlert={showPaymentSuccessfull}
            />


            {/* Footer */}
            <div className="footer-text">
              <Row>
                <Col>
                  <a
                    href="https://twitter.com/TunnelSats"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span class="icon icon-twitter"></span>
                  </a>
                </Col>
                <Col>
                  <a
                    href="https://github.com/blckbx/tunnelsats"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span class="icon icon-github"></span>
                  </a>
                </Col>
                <Col>
                  <a
                    href={REACT_APP_LNBITS_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span class="icon icon-heart"></span>
                  </a>
                </Col>
                <Col>
                  <a
                    href="https://t.me/+NJylaUom-rxjYjU6"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span class="icon icon-telegram"></span>
                  </a>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;
