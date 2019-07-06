import React from "react";
import { Spin, Card, message } from "antd";

import { VCL } from "../urls";
import "./vcl.sass";
import request from "../request";

class VCLView extends React.Component {
  state = {
    loading: false,
    vcl: ""
  };
  async componentDidMount() {
    this.setState({
      loading: true
    });
    try {
      const { data } = await request.get(VCL);
      this.setState({
        vcl: data.vcl
      });
    } catch (err) {
      message.error(err.message);
    } finally {
      this.setState({
        loading: false
      });
    }
  }
  renderVCL() {
    const { vcl } = this.state;
    if (!vcl) {
      return;
    }
    return <Card title="varnish vcl">
        <pre>{vcl}</pre>
      </Card>;
  }
  render() {
    const { loading } = this.state;

    return (
      <div className="VCL">
        {loading && (
          <div
            style={{
              textAlign: "center",
              paddingTop: "50px"
            }}
          >
            <Spin tip="Loading..." />
          </div>
        )}
        {this.renderVCL()}
      </div>
    );
  }
}

export default VCLView;
