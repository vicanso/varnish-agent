import React from "react";
import { Spin, Form, Input, Select, Button, InputNumber, message } from "antd";

import "./add_update_director.sass";
import * as router from "../router";

const Option = Select.Option;

const roundRobin = "round_robin";
const fallback = "fallback";
const random = "random";
const hash = "hash";

class AddUpdateDirector extends React.Component {
  state = {
    type: "",
    inited: false,
    spinning: false,
    spinTips: "",
    name: "",
    hosts: null,
    prefixs: null,
    backends: null,
    connectTimeout: null,
    firstByteTimeout: null,
    betweenBytesTimeout: null,
    policy: "",
    policyKey: ""
  };
  async handleSubmit(e) {
    e.preventDefault();
    const {
      name,
      hosts,
      prefixs,
      connectTimeout,
      firstByteTimeout,
      betweenBytesTimeout,
      policy,
      policyKey,
      backends
    } = this.state;
    const data = {
      name,
      hosts,
      prefixs,
      connectTimeout: connectTimeout || 0,
      firstByteTimeout: firstByteTimeout || 0,
      betweenBytesTimeout: betweenBytesTimeout || 0,
      policy,
      policyKey
    };

    this.setState({
      spinning: true,
      spinTips: "Submitting..."
    });
    try {
      if (data.policy === hash && !data.policyKey) {
        throw new Error("hash policy require a key");
      }
      if (backends && backends.length !== 0) {
        data.backends = backends.map(str => {
          const arr = str.split(":");
          if (arr.length < 2) {
            throw new Error(`${str} is invalid`);
          }
          const [ip, p] = arr;
          const port = Number.parseInt(p);
          if (Number.isNaN(port)) {
            throw new Error(`port of ${str} is invalid`);
          }
          return {
            ip,
            port
          };
        });
      }
      await this.submit(data);
      router.back();
    } catch (err) {
      message.error(err.message);
    } finally {
      this.setState({
        spinning: false
      });
    }
  }
  renderSelector({ label, key, value, placeholder }) {
    let arr = null;
    if (value.length !== 0) {
      arr = value.map(item => <Option key={item}>{item}</Option>);
    }
    return (
      <Form.Item label={label}>
        <Select
          defaultValue={value}
          placeholder={placeholder}
          mode="tags"
          onChange={v => {
            const update = {};
            update[key] = v;
            this.setState(update);
          }}
        >
          {arr}
        </Select>
      </Form.Item>
    );
  }
  renderHosts() {
    const { hosts } = this.state;
    return this.renderSelector({
      label: "Hosts",
      key: "hosts",
      value: hosts || [],
      placeholder: "Input the hosts of director, e.g.: aslant.site"
    });
  }
  renderPrefixs() {
    const { prefixs } = this.state;
    return this.renderSelector({
      label: "Prefixs",
      key: "prefixs",
      value: prefixs || [],
      placeholder: "Input the prefixs of director, e.g.: /api"
    });
  }
  renderBackends() {
    const { backends } = this.state;
    return this.renderSelector({
      label: "Backends",
      key: "backends",
      value: backends || [],
      placeholder: "Input the backend of director, e.g.: 127.0.0.1:3000"
    });
  }
  renderTimeout({ label, key }) {
    const value = this.state[key];
    return (
      <Form.Item label={label}>
        <InputNumber
          style={{
            width: "100%"
          }}
          min={0}
          max={60}
          placeholder="Input the timeout seconds"
          defaultValue={value}
          onChange={value => {
            const update = {};
            update[key] = value;
            this.setState(update);
          }}
        />
      </Form.Item>
    );
  }
  renderPolicy() {
    const { policy, policyKey } = this.state;
    const arr = [roundRobin, fallback, random, hash].map(item => (
      <Option key={item}>{item}</Option>
    ));
    let policyKeyItem = null;
    if (policy === hash) {
      policyKeyItem = (
        <Form.Item label="Policy Key">
          <Input
            defaultValue={policyKey}
            placeholder="Input the key for policy"
            onChange={e => {
              this.setState({
                policyKey: e.target.value
              });
            }}
          />
        </Form.Item>
      );
    }
    return (
      <div>
        <Form.Item label="Policy">
          <Select
            defaultValue={policy}
            placeholder={"Select the policy for director"}
            onChange={value => {
              this.setState({
                policy: value
              });
            }}
          >
            {arr}
          </Select>
        </Form.Item>
        {policyKeyItem}
      </div>
    );
  }
  renderForm() {
    const { inited, name, type } = this.state;

    if (!inited) {
      return <div />;
    }
    const formItemLayout = {
      labelCol: {
        xs: { span: 24 },
        sm: { span: 6 }
      },
      wrapperCol: {
        xs: { span: 24 },
        sm: { span: 18 }
      }
    };
    const tailFormItemLayout = {
      wrapperCol: {
        xs: {
          span: 24,
          offset: 0
        },
        sm: {
          span: 22,
          offset: 2
        }
      }
    };
    return (
      <Form {...formItemLayout} onSubmit={this.handleSubmit.bind(this)}>
        <Form.Item label="Name">
          <Input
            defaultValue={name}
            type="text"
            disabled={type === "update"}
            onChange={e => {
              this.setState({
                name: e.target.value
              });
            }}
            placeholder="Input the name of director"
          />
        </Form.Item>
        {this.renderHosts()}
        {this.renderPrefixs()}
        {this.renderBackends()}
        {this.renderTimeout({
          label: "ConnectTimeout",
          key: "connectTimeout"
        })}
        {this.renderTimeout({
          label: "FirstByteTimeout",
          key: "firstByteTimeout"
        })}
        {this.renderTimeout({
          label: "BetweenBytesTimeout",
          key: "betweenBytesTimeout"
        })}
        {this.renderPolicy()}
        <Form.Item {...tailFormItemLayout}>
          <Button className="submit" type="primary" htmlType="submit">
            {type.toUpperCase()}
          </Button>
        </Form.Item>
      </Form>
    );
  }
  render() {
    const { spinning, spinTips } = this.state;
    return (
      <div className="AddUpdateDirector">
        <Spin spinning={spinning} tip={spinTips}>
          {this.renderForm()}
        </Spin>
      </div>
    );
  }
}

export default AddUpdateDirector;
