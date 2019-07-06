import React from "react";
import { Link, withRouter } from "react-router-dom";

import { BASIC_INFO_PATH, DIRECTOR_PATH, VCL_PATH } from "../paths";
import "./app_header.sass";

const paths = [
  {
    name: "Basic Info",
    path: BASIC_INFO_PATH
  },
  {
    name: "Directors",
    path: DIRECTOR_PATH
  },
  {
    name: "VCL",
    path: VCL_PATH
  }
];

class AppHeader extends React.Component {
  state = {
    active: -1
  };
  render() {
    const { active } = this.state;
    const arr = paths.map((item, index) => {
      let className = "";
      if (index === active) {
        className = "active";
      }
      return (
        <li key={item.name}>
          <Link to={item.path} className={className}>
            {item.name}
          </Link>
        </li>
      );
    });
    return (
      <div className="AppHeader clearfix">
        <div className="logo">Varnish Agent</div>
        <ul className="functions">{arr}</ul>
      </div>
    );
  }
  changeActive(routePath) {
    let active = -1;
    paths.forEach((item, index) => {
      if (item.path === routePath) {
        active = index;
      }
    });
    this.setState({
      active
    });
  }
  componentWillReceiveProps(newProps) {
    this.changeActive(newProps.location.pathname);
  }
  componentWillMount() {
    this.changeActive(this.props.location.pathname);
  }
}

export default withRouter(props => <AppHeader {...props} />);
