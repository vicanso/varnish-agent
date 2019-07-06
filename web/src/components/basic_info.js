import React from "react";

import request from "../request";
import { CONFIG } from "../urls";
import "./basic_info.sass";
import { Spin, message, Card } from "antd";

class BasicInfo extends React.Component {
  state = {
    spinning: false,
    spinTips: "",
    basicInfo: null
  };
  async componentDidMount() {
    this.setState({
      spinTips: "Loading...",
      spinning: true
    });
    try {
      const { data } = await request.get(CONFIG);
      this.setState({
        basicInfo: data
      });
    } catch (err) {
      message.error(err.message);
    } finally {
      this.setState({
        spinning: false
      });
    }
  }
  renderBasicInfo() {
    const { basicInfo } = this.state;
    let basicInfoView = null;
    if (basicInfo) {
      const arr = [];
      Object.keys(basicInfo).forEach(key => {
        arr.push(
          <li key={key}>
            <span className="key">{key}:</span>
            <span>{basicInfo[key]}</span>
          </li>
        );
      });
      basicInfoView = <ul>{arr}</ul>;
    }
    return <Card title="Basic Info">{basicInfoView}</Card>;
  }
  render() {
    const { spinTips, spinning } = this.state;
    return (
      <div className="BasicInfo">
        <Spin spinning={spinning} tip={spinTips}>
          {this.renderBasicInfo()}
        </Spin>
      </div>
    );
  }
}

export default BasicInfo;
