import React from "react";
import { Spin, message, Button, Card, Icon, Popconfirm } from "antd";
import { Link } from "react-router-dom";

import { DIRECTORS } from "../urls";
import request from "../request";
import { ADD_DIRECTOR_PATH, UPDATE_DIRECTOR_PATH } from "../paths";

import "./director.sass";

class Director extends React.Component {
  state = {
    loading: false,
    directors: null,
    removing: false
  };
  async removeDirector(name) {
    const { directors, removing } = this.state;
    if (removing) {
      return;
    }
    this.setState({
      removing: true
    });
    try {
      await request.delete(`${DIRECTORS}/${name}`);
      this.setState({
        directors: directors.filter(item => item.name !== name)
      });
    } catch (err) {
      message.error(err.message);
    } finally {
      this.setState({
        removing: false
      });
    }
  }
  renderDirectors() {
    const { directors } = this.state;
    if (!directors || directors.length === 0) {
      return;
    }

    const createList = (name, arr) => {
      if (!arr || arr.length === 0) {
        return;
      }
      const items = arr.map(item => {
        if (name !== "Backends") {
          return <li key={item}>{item}</li>;
        }
        const value = `${item.ip}:${item.port}`;
        return <li key={value}>{value}</li>;
      });
      return (
        <div>
          <h5>{name}</h5>
          <ul>{items}</ul>
        </div>
      );
    };
    const createOtherInfos = d => {
      const keys = [
        "connectTimeout",
        "firstByteTimeout",
        "betweenBytesTimeout"
      ];
      const arr = [];
      keys.forEach(key => {
        if (!d[key]) {
          return;
        }
        arr.push(
          <span key={key}>
            {key}:{d[key]}s
          </span>
        );
      });
      if (d.policy) {
        let key = d.policy;
        if (d.policyKey) {
          key += `(${d.policyKey})`;
        }
        arr.push(<span key="policy">policy:{key}</span>);
      }
      if (arr.length === 0) {
        return;
      }
      return <div className="otherInfos">{arr}</div>;
    };
    const arr = directors.map(d => {
      const title = (
        <div>
          {d.name}
          <Link
            to={UPDATE_DIRECTOR_PATH.replace(":name", d.name)}
            style={{
              margin: "0 10px"
            }}
          >
            <Icon type="edit" />
          </Link>
          <Popconfirm
            title="Are you sure delete this director?"
            onConfirm={() => {
              this.removeDirector(d.name);
            }}
          >
            <a href="/delete">
              <Icon type="delete" />
            </a>
          </Popconfirm>
        </div>
      );
      return (
        <Card title={title} key={d.name} className="director">
          {createOtherInfos(d)}
          {createList("Hosts", d.hosts)}
          {createList("Prefixs", d.prefixs)}
          {createList("Backends", d.backends)}
        </Card>
      );
    });
    return <div className="directors">{arr}</div>;
  }
  render() {
    const { loading } = this.state;
    return (
      <div className="Director">
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
        {this.renderDirectors()}
        {!loading && (
          <div className="addDirector">
            <Link to={ADD_DIRECTOR_PATH}>
              <Button type="link" icon="plus-circle">
                Add Director
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }
  async componentDidMount() {
    this.setState({
      loading: true
    });
    try {
      const { data } = await request.get(DIRECTORS);
      this.setState({
        directors: data.directors
      });
    } catch (err) {
      message.error(err.message);
    } finally {
      this.setState({
        loading: false
      });
    }
  }
}

export default Director;
